const Stock = require('../models/Stock');
const Transaction = require('../models/Transaction');
const { createHttpError } = require('../utils/httpError');
const {
  ensureObjectId,
  optionalObjectId,
  optionalString,
  parseDate,
  parseEnum,
  parseNumber,
  parsePagination,
} = require('../utils/validation');
const {
  assertPortfolioCanFillOrder,
  ensurePortfolioForUser,
  recalculatePortfolioFromTransactions,
} = require('../services/portfolioService');

const normalizeTransactionPayload = (body, options = {}) => {
  const partial = options.partial || false;

  const payload = {};

  if (!partial || body.side !== undefined) {
    payload.side = parseEnum(body.side, 'side', ['buy', 'sell'], !partial || body.side !== undefined);
  }

  if (!partial || body.quantity !== undefined) {
    payload.quantity = parseNumber(body.quantity, 'quantity', {
      required: !partial || body.quantity !== undefined,
      min: 0.000001,
    });
  }

  if (!partial || body.price !== undefined) {
    payload.price = parseNumber(body.price, 'price', {
      required: !partial || body.price !== undefined,
      min: 0.000001,
    });
  }

  if (!partial || body.fees !== undefined) {
    payload.fees = parseNumber(body.fees, 'fees', {
      required: false,
      min: 0,
    });
    if (payload.fees === undefined) {
      payload.fees = 0;
    }
  }

  if (!partial || body.status !== undefined) {
    payload.status = parseEnum(
      body.status,
      'status',
      ['pending', 'filled', 'cancelled'],
      !partial || body.status !== undefined
    );
    if (payload.status === undefined) {
      payload.status = 'filled';
    }
  }

  if (!partial || body.executedAt !== undefined) {
    payload.executedAt = parseDate(body.executedAt, 'executedAt', false);
  }

  if (!partial || body.note !== undefined) {
    payload.note = optionalString(body.note, 'note', 280);
  }

  if (!partial || body.stockId !== undefined) {
    payload.stockId = optionalObjectId(body.stockId, 'stockId');
  }

  if (!partial || body.symbol !== undefined) {
    payload.symbol = optionalString(body.symbol, 'symbol', 15);
    if (payload.symbol) {
      payload.symbol = payload.symbol.toUpperCase();
    }
  }

  return payload;
};

const resolveStockReference = async ({ stockId, symbol }) => {
  if (stockId) {
    const stock = await Stock.findById(stockId);
    if (!stock) {
      throw createHttpError(404, 'Stock not found');
    }
    return stock;
  }

  if (symbol) {
    const stock = await Stock.findOne({ symbol });
    if (!stock) {
      throw createHttpError(404, `Stock not found for symbol ${symbol}`);
    }
    return stock;
  }

  throw createHttpError(400, 'Either stockId or symbol is required');
};

const canAccessTransaction = (requestUser, transactionUserId) =>
  requestUser.role === 'admin' || String(requestUser._id) === String(transactionUserId);

const buildTransactionResponse = (transaction) => ({
  id: transaction._id,
  user: transaction.user,
  stock: transaction.stock,
  portfolio: transaction.portfolio,
  side: transaction.side,
  quantity: transaction.quantity,
  price: transaction.price,
  fees: transaction.fees,
  totalAmount: transaction.totalAmount,
  status: transaction.status,
  executedAt: transaction.executedAt,
  note: transaction.note,
  createdAt: transaction.createdAt,
  updatedAt: transaction.updatedAt,
});

const listTransactions = async (req, res, next) => {
  try {
    const { page, limit, skip } = parsePagination(req.query, 20, 100);
    const query = {};

    if (req.user.role === 'admin' && req.query.userId) {
      query.user = ensureObjectId(req.query.userId, 'userId');
    } else if (req.user.role !== 'admin' || req.query.includeAll !== 'true') {
      query.user = req.user._id;
    }

    if (req.query.side !== undefined) {
      query.side = parseEnum(req.query.side, 'side', ['buy', 'sell']);
    }

    if (req.query.status !== undefined) {
      query.status = parseEnum(req.query.status, 'status', ['pending', 'filled', 'cancelled']);
    }

    if (req.query.stockId) {
      query.stock = ensureObjectId(req.query.stockId, 'stockId');
    }

    if (req.query.symbol) {
      const stock = await Stock.findOne({ symbol: req.query.symbol.toUpperCase() }, '_id');
      if (!stock) {
        return res.status(200).json({
          page,
          limit,
          total: 0,
          totalPages: 1,
          items: [],
        });
      }
      query.stock = stock._id;
    }

    const executedAt = {};
    const dateFrom = parseDate(req.query.dateFrom, 'dateFrom', false);
    const dateTo = parseDate(req.query.dateTo, 'dateTo', false);
    if (dateFrom) {
      executedAt.$gte = dateFrom;
    }
    if (dateTo) {
      executedAt.$lte = dateTo;
    }
    if (Object.keys(executedAt).length > 0) {
      query.executedAt = executedAt;
    }

    const [transactions, total] = await Promise.all([
      Transaction.find(query)
        .populate('stock', 'symbol name exchange currency lastPrice')
        .populate('user', 'name email role')
        .sort({ executedAt: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Transaction.countDocuments(query),
    ]);

    res.status(200).json({
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
      items: transactions.map(buildTransactionResponse),
    });
  } catch (error) {
    next(error);
  }
};

const getTransactionById = async (req, res, next) => {
  try {
    const transactionId = ensureObjectId(req.params.id, 'Transaction id');
    const transaction = await Transaction.findById(transactionId)
      .populate('stock', 'symbol name exchange currency lastPrice')
      .populate('user', 'name email role');

    if (!transaction) {
      throw createHttpError(404, 'Transaction not found');
    }

    if (!canAccessTransaction(req.user, transaction.user._id)) {
      throw createHttpError(403, 'Forbidden: cannot access this transaction');
    }

    res.status(200).json({ transaction: buildTransactionResponse(transaction) });
  } catch (error) {
    next(error);
  }
};

const createTransaction = async (req, res, next) => {
  try {
    const normalized = normalizeTransactionPayload(req.body, { partial: false });
    const stock = await resolveStockReference(normalized);
    const portfolio = await ensurePortfolioForUser(req.user._id);

    await recalculatePortfolioFromTransactions(req.user._id, { portfolio });

    if (normalized.status === 'filled') {
      assertPortfolioCanFillOrder(portfolio, {
        stock: stock._id,
        side: normalized.side,
        quantity: normalized.quantity,
        price: normalized.price,
        fees: normalized.fees,
      });
    }

    const transaction = await Transaction.create({
      user: req.user._id,
      stock: stock._id,
      portfolio: portfolio._id,
      side: normalized.side,
      quantity: normalized.quantity,
      price: normalized.price,
      fees: normalized.fees,
      status: normalized.status,
      executedAt: normalized.executedAt || new Date(),
      note: normalized.note,
    });

    const refreshedPortfolio = await recalculatePortfolioFromTransactions(req.user._id, {
      portfolio,
    });

    res.status(201).json({
      transaction: buildTransactionResponse(transaction),
      portfolio: refreshedPortfolio,
    });
  } catch (error) {
    next(error);
  }
};

const updateTransaction = async (req, res, next) => {
  try {
    const transactionId = ensureObjectId(req.params.id, 'Transaction id');
    const transaction = await Transaction.findById(transactionId);

    if (!transaction) {
      throw createHttpError(404, 'Transaction not found');
    }

    if (!canAccessTransaction(req.user, transaction.user)) {
      throw createHttpError(403, 'Forbidden: cannot update this transaction');
    }

    const normalized = normalizeTransactionPayload(req.body, { partial: true });
    if (Object.keys(req.body || {}).length === 0) {
      throw createHttpError(400, 'No fields provided for update');
    }

    let stock = null;
    if (normalized.stockId || normalized.symbol) {
      stock = await resolveStockReference(normalized);
    }

    const originalState = {
      stock: transaction.stock,
      side: transaction.side,
      quantity: transaction.quantity,
      price: transaction.price,
      fees: transaction.fees,
      status: transaction.status,
      executedAt: transaction.executedAt,
      note: transaction.note,
    };

    if (stock) {
      transaction.stock = stock._id;
    }
    if (normalized.side !== undefined) {
      transaction.side = normalized.side;
    }
    if (normalized.quantity !== undefined) {
      transaction.quantity = normalized.quantity;
    }
    if (normalized.price !== undefined) {
      transaction.price = normalized.price;
    }
    if (normalized.fees !== undefined) {
      transaction.fees = normalized.fees;
    }
    if (normalized.status !== undefined) {
      transaction.status = normalized.status;
    }
    if (normalized.executedAt !== undefined) {
      transaction.executedAt = normalized.executedAt;
    }
    if (normalized.note !== undefined) {
      transaction.note = normalized.note;
    }

    await transaction.save();

    try {
      await ensurePortfolioForUser(transaction.user);
      await recalculatePortfolioFromTransactions(transaction.user);
    } catch (error) {
      transaction.stock = originalState.stock;
      transaction.side = originalState.side;
      transaction.quantity = originalState.quantity;
      transaction.price = originalState.price;
      transaction.fees = originalState.fees;
      transaction.status = originalState.status;
      transaction.executedAt = originalState.executedAt;
      transaction.note = originalState.note;
      await transaction.save();
      throw error;
    }

    res.status(200).json({ transaction: buildTransactionResponse(transaction) });
  } catch (error) {
    next(error);
  }
};

const deleteTransaction = async (req, res, next) => {
  try {
    const transactionId = ensureObjectId(req.params.id, 'Transaction id');
    const transaction = await Transaction.findById(transactionId);

    if (!transaction) {
      throw createHttpError(404, 'Transaction not found');
    }

    if (!canAccessTransaction(req.user, transaction.user)) {
      throw createHttpError(403, 'Forbidden: cannot delete this transaction');
    }

    const ownerId = transaction.user;
    await transaction.deleteOne();
    await recalculatePortfolioFromTransactions(ownerId);

    res.status(200).json({ message: 'Transaction deleted successfully' });
  } catch (error) {
    next(error);
  }
};

const deleteAllTransactionsForCurrentUser = async (req, res, next) => {
  try {
    await Transaction.deleteMany({ user: req.user._id });
    await recalculatePortfolioFromTransactions(req.user._id);
    res.status(200).json({ message: 'All transactions deleted for current user' });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  listTransactions,
  getTransactionById,
  createTransaction,
  updateTransaction,
  deleteTransaction,
  deleteAllTransactionsForCurrentUser,
};
