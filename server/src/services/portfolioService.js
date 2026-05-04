const Portfolio = require('../models/Portfolio');
const Stock = require('../models/Stock');
const Transaction = require('../models/Transaction');
const { createHttpError } = require('../utils/httpError');

const DEFAULT_BASE_CASH_BALANCE = 100000;

const roundCurrency = (value) => Number((Number(value) || 0).toFixed(2));
const roundQuantity = (value) => Number((Number(value) || 0).toFixed(6));

const ensurePortfolioForUser = async (userId, options = {}) => {
  let portfolio = await Portfolio.findOne({ user: userId });

  if (portfolio) {
    return portfolio;
  }

  const baseCashBalance = roundCurrency(
    options.baseCashBalance === undefined ? DEFAULT_BASE_CASH_BALANCE : options.baseCashBalance
  );

  portfolio = await Portfolio.create({
    user: userId,
    baseCashBalance,
    cashBalance: baseCashBalance,
    holdings: [],
    totalInvested: 0,
    totalMarketValue: baseCashBalance,
    realizedPnL: 0,
  });

  return portfolio;
};

const assertPortfolioCanFillOrder = (portfolio, order) => {
  const quantity = Number(order.quantity) || 0;
  const price = Number(order.price) || 0;
  const fees = Number(order.fees) || 0;
  const side = order.side;

  if (side === 'buy') {
    const totalRequired = roundCurrency(quantity * price + fees);
    if (Number(portfolio.cashBalance) < totalRequired) {
      throw createHttpError(422, `Insufficient cash balance. Required: ${totalRequired}`);
    }
    return;
  }

  if (side === 'sell') {
    const stockId = String(order.stock);
    const holding = (portfolio.holdings || []).find((item) => String(item.stock) === stockId);
    const availableQuantity = Number(holding?.quantity) || 0;

    if (availableQuantity < quantity) {
      throw createHttpError(
        422,
        `Insufficient stock quantity to sell. Available: ${availableQuantity}, requested: ${quantity}`
      );
    }
  }
};

const recalculatePortfolioFromTransactions = async (userId, options = {}) => {
  const portfolio = options.portfolio || (await ensurePortfolioForUser(userId));
  const strictMode = options.strictMode !== false;
  const baseCashBalance = roundCurrency(
    portfolio.baseCashBalance === undefined ? DEFAULT_BASE_CASH_BALANCE : portfolio.baseCashBalance
  );

  const transactions = await Transaction.find({
    user: userId,
    status: 'filled',
  })
    .sort({ executedAt: 1, createdAt: 1, _id: 1 })
    .lean();

  const holdingsState = new Map();
  let cashBalance = baseCashBalance;
  let realizedPnL = 0;

  for (const tx of transactions) {
    const stockKey = String(tx.stock);
    const side = tx.side;
    const quantity = Number(tx.quantity) || 0;
    const price = Number(tx.price) || 0;
    const fees = Number(tx.fees) || 0;

    if (!stockKey || quantity <= 0 || price < 0 || fees < 0) {
      if (strictMode) {
        throw createHttpError(422, `Invalid transaction data found: ${tx._id}`);
      }
      continue;
    }

    const entry = holdingsState.get(stockKey) || {
      stock: tx.stock,
      quantity: 0,
      totalCost: 0,
    };

    if (side === 'buy') {
      const buyCost = quantity * price + fees;
      if (strictMode && cashBalance < buyCost) {
        throw createHttpError(422, `Transaction ${tx._id} exceeds available cash balance`);
      }

      cashBalance = roundCurrency(cashBalance - buyCost);
      entry.quantity = roundQuantity(entry.quantity + quantity);
      entry.totalCost = roundCurrency(entry.totalCost + buyCost);
      holdingsState.set(stockKey, entry);
      continue;
    }

    if (side === 'sell') {
      if (strictMode && entry.quantity < quantity) {
        throw createHttpError(422, `Transaction ${tx._id} exceeds available holdings`);
      }

      if (entry.quantity <= 0) {
        continue;
      }

      const avgCost = entry.totalCost / entry.quantity;
      const consumedCost = avgCost * quantity;
      const proceeds = quantity * price - fees;

      entry.quantity = roundQuantity(entry.quantity - quantity);
      entry.totalCost = roundCurrency(entry.totalCost - consumedCost);

      cashBalance = roundCurrency(cashBalance + proceeds);
      realizedPnL = roundCurrency(realizedPnL + (proceeds - consumedCost));

      if (entry.quantity <= 0.000001) {
        holdingsState.delete(stockKey);
      } else {
        holdingsState.set(stockKey, entry);
      }
    }
  }

  const stockIds = Array.from(holdingsState.values()).map((holding) => holding.stock);
  const stockDocuments = await Stock.find({ _id: { $in: stockIds } }, 'lastPrice').lean();
  const stockPriceMap = new Map(stockDocuments.map((stock) => [String(stock._id), Number(stock.lastPrice) || 0]));

  const holdings = [];
  let totalInvested = 0;
  let holdingsMarketValue = 0;

  for (const entry of holdingsState.values()) {
    if (entry.quantity <= 0) {
      continue;
    }

    const stockId = String(entry.stock);
    const averagePrice = roundCurrency(entry.totalCost / entry.quantity);
    const marketPrice = roundCurrency(stockPriceMap.get(stockId) || averagePrice);
    const marketValue = roundCurrency(entry.quantity * marketPrice);

    holdings.push({
      stock: entry.stock,
      quantity: roundQuantity(entry.quantity),
      averagePrice,
      marketPrice,
      marketValue,
    });

    totalInvested = roundCurrency(totalInvested + entry.totalCost);
    holdingsMarketValue = roundCurrency(holdingsMarketValue + marketValue);
  }

  portfolio.baseCashBalance = baseCashBalance;
  portfolio.cashBalance = roundCurrency(cashBalance);
  portfolio.holdings = holdings;
  portfolio.totalInvested = totalInvested;
  portfolio.totalMarketValue = roundCurrency(holdingsMarketValue + cashBalance);
  portfolio.realizedPnL = roundCurrency(realizedPnL);

  await portfolio.save();

  return portfolio;
};

module.exports = {
  DEFAULT_BASE_CASH_BALANCE,
  ensurePortfolioForUser,
  assertPortfolioCanFillOrder,
  recalculatePortfolioFromTransactions,
};
