const Portfolio = require('../models/Portfolio');
const Transaction = require('../models/Transaction');
const User = require('../models/User');
const { createHttpError } = require('../utils/httpError');
const { ensureObjectId, parseNumber, parsePagination } = require('../utils/validation');
const {
  DEFAULT_BASE_CASH_BALANCE,
  ensurePortfolioForUser,
  recalculatePortfolioFromTransactions,
} = require('../services/portfolioService');

const canAccessPortfolio = (requestUser, portfolioUserId) =>
  requestUser.role === 'admin' || String(requestUser._id) === String(portfolioUserId);

const buildPortfolioResponse = (portfolio) => ({
  id: portfolio._id,
  user: portfolio.user,
  baseCashBalance: portfolio.baseCashBalance,
  cashBalance: portfolio.cashBalance,
  holdings: portfolio.holdings,
  totalInvested: portfolio.totalInvested,
  totalMarketValue: portfolio.totalMarketValue,
  realizedPnL: portfolio.realizedPnL,
  createdAt: portfolio.createdAt,
  updatedAt: portfolio.updatedAt,
});

const listPortfolios = async (req, res, next) => {
  try {
    const { page, limit, skip } = parsePagination(req.query, 20, 100);
    const query = {};

    if (req.user.role !== 'admin') {
      query.user = req.user._id;
    } else if (req.query.userId) {
      query.user = ensureObjectId(req.query.userId, 'userId');
    }

    const [items, total] = await Promise.all([
      Portfolio.find(query)
        .populate('user', 'name email role')
        .populate('holdings.stock', 'symbol name')
        .sort({ updatedAt: -1 })
        .skip(skip)
        .limit(limit),
      Portfolio.countDocuments(query),
    ]);

    res.status(200).json({
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
      items: items.map(buildPortfolioResponse),
    });
  } catch (error) {
    next(error);
  }
};

const createPortfolio = async (req, res, next) => {
  try {
    const targetUserId =
      req.user.role === 'admin' && req.body.userId
        ? ensureObjectId(req.body.userId, 'userId')
        : String(req.user._id);

    const userExists = await User.exists({ _id: targetUserId });
    if (!userExists) {
      throw createHttpError(404, 'User not found');
    }

    const baseCashBalance =
      parseNumber(req.body.baseCashBalance, 'baseCashBalance', {
        required: false,
        min: 0,
      }) || DEFAULT_BASE_CASH_BALANCE;

    const existingPortfolio = await Portfolio.findOne({ user: targetUserId });
    if (existingPortfolio) {
      const refreshed = await recalculatePortfolioFromTransactions(targetUserId, {
        portfolio: existingPortfolio,
      });
      return res.status(200).json({ portfolio: buildPortfolioResponse(refreshed) });
    }

    const portfolio = await ensurePortfolioForUser(targetUserId, { baseCashBalance });
    return res.status(201).json({ portfolio: buildPortfolioResponse(portfolio) });
  } catch (error) {
    return next(error);
  }
};

const getCurrentPortfolio = async (req, res, next) => {
  try {
    const portfolio = await ensurePortfolioForUser(req.user._id);
    const refreshed = await recalculatePortfolioFromTransactions(req.user._id, { portfolio });
    await refreshed.populate('holdings.stock', 'symbol name exchange currency lastPrice');
    res.status(200).json({ portfolio: buildPortfolioResponse(refreshed) });
  } catch (error) {
    next(error);
  }
};

const getPortfolioById = async (req, res, next) => {
  try {
    const portfolioId = ensureObjectId(req.params.id, 'Portfolio id');
    const portfolio = await Portfolio.findById(portfolioId)
      .populate('user', 'name email role')
      .populate('holdings.stock', 'symbol name exchange currency lastPrice');

    if (!portfolio) {
      throw createHttpError(404, 'Portfolio not found');
    }

    if (!canAccessPortfolio(req.user, portfolio.user._id || portfolio.user)) {
      throw createHttpError(403, 'Forbidden: cannot access this portfolio');
    }

    const refreshed = await recalculatePortfolioFromTransactions(portfolio.user._id || portfolio.user, {
      portfolio,
    });
    await refreshed.populate('holdings.stock', 'symbol name exchange currency lastPrice');

    res.status(200).json({ portfolio: buildPortfolioResponse(refreshed) });
  } catch (error) {
    next(error);
  }
};

const updateCurrentPortfolio = async (req, res, next) => {
  try {
    const portfolio = await ensurePortfolioForUser(req.user._id);
    const baseCashBalance = parseNumber(req.body.baseCashBalance, 'baseCashBalance', {
      required: false,
      min: 0,
    });
    const cashAdjustment = parseNumber(req.body.cashAdjustment, 'cashAdjustment', {
      required: false,
    });

    if (baseCashBalance === undefined && cashAdjustment === undefined) {
      throw createHttpError(400, 'Provide baseCashBalance or cashAdjustment');
    }

    if (baseCashBalance !== undefined) {
      portfolio.baseCashBalance = baseCashBalance;
    }

    if (cashAdjustment !== undefined) {
      portfolio.baseCashBalance = Number(portfolio.baseCashBalance) + cashAdjustment;
      if (portfolio.baseCashBalance < 0) {
        throw createHttpError(400, 'baseCashBalance cannot become negative after adjustment');
      }
    }

    const refreshed = await recalculatePortfolioFromTransactions(req.user._id, { portfolio });
    await refreshed.populate('holdings.stock', 'symbol name exchange currency lastPrice');

    res.status(200).json({ portfolio: buildPortfolioResponse(refreshed) });
  } catch (error) {
    next(error);
  }
};

const deleteCurrentPortfolio = async (req, res, next) => {
  try {
    await Promise.all([
      Transaction.deleteMany({ user: req.user._id }),
      Portfolio.deleteOne({ user: req.user._id }),
    ]);

    res.status(200).json({ message: 'Portfolio and transactions deleted for current user' });
  } catch (error) {
    next(error);
  }
};

const deletePortfolioById = async (req, res, next) => {
  try {
    const portfolioId = ensureObjectId(req.params.id, 'Portfolio id');
    const portfolio = await Portfolio.findById(portfolioId);

    if (!portfolio) {
      throw createHttpError(404, 'Portfolio not found');
    }

    if (!canAccessPortfolio(req.user, portfolio.user)) {
      throw createHttpError(403, 'Forbidden: cannot delete this portfolio');
    }

    await Promise.all([
      Transaction.deleteMany({ user: portfolio.user }),
      Portfolio.deleteOne({ _id: portfolio._id }),
    ]);

    res.status(200).json({ message: 'Portfolio deleted successfully' });
  } catch (error) {
    next(error);
  }
};

const updatePortfolioById = async (req, res, next) => {
  try {
    const portfolioId = ensureObjectId(req.params.id, 'Portfolio id');
    const portfolio = await Portfolio.findById(portfolioId);

    if (!portfolio) {
      throw createHttpError(404, 'Portfolio not found');
    }

    if (!canAccessPortfolio(req.user, portfolio.user)) {
      throw createHttpError(403, 'Forbidden: cannot update this portfolio');
    }

    const baseCashBalance = parseNumber(req.body.baseCashBalance, 'baseCashBalance', {
      required: false,
      min: 0,
    });
    const cashAdjustment = parseNumber(req.body.cashAdjustment, 'cashAdjustment', {
      required: false,
    });

    if (baseCashBalance === undefined && cashAdjustment === undefined) {
      throw createHttpError(400, 'Provide baseCashBalance or cashAdjustment');
    }

    if (baseCashBalance !== undefined) {
      portfolio.baseCashBalance = baseCashBalance;
    }

    if (cashAdjustment !== undefined) {
      portfolio.baseCashBalance = Number(portfolio.baseCashBalance) + cashAdjustment;
      if (portfolio.baseCashBalance < 0) {
        throw createHttpError(400, 'baseCashBalance cannot become negative after adjustment');
      }
    }

    const refreshed = await recalculatePortfolioFromTransactions(portfolio.user, { portfolio });
    await refreshed.populate('holdings.stock', 'symbol name exchange currency lastPrice');
    res.status(200).json({ portfolio: buildPortfolioResponse(refreshed) });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  listPortfolios,
  createPortfolio,
  getCurrentPortfolio,
  getPortfolioById,
  updateCurrentPortfolio,
  updatePortfolioById,
  deleteCurrentPortfolio,
  deletePortfolioById,
};
