const dotenv = require('dotenv');
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const User = require('../models/User');
const Stock = require('../models/Stock');
const Portfolio = require('../models/Portfolio');
const Session = require('../models/Session');
const Transaction = require('../models/Transaction');
const Watchlist = require('../models/Watchlist');
const {
  DEFAULT_BASE_CASH_BALANCE,
  recalculatePortfolioFromTransactions,
} = require('../services/portfolioService');

dotenv.config();

const models = [User, Stock, Portfolio, Transaction, Watchlist, Session];

const DEFAULT_STOCKS = [
  { symbol: 'AAPL', name: 'Apple Inc.', exchange: 'NASDAQ', sector: 'Technology', lastPrice: 189.22 },
  { symbol: 'MSFT', name: 'Microsoft Corporation', exchange: 'NASDAQ', sector: 'Technology', lastPrice: 411.66 },
  { symbol: 'NVDA', name: 'NVIDIA Corporation', exchange: 'NASDAQ', sector: 'Semiconductors', lastPrice: 911.7 },
  { symbol: 'AMD', name: 'Advanced Micro Devices, Inc.', exchange: 'NASDAQ', sector: 'Semiconductors', lastPrice: 178.44 },
  { symbol: 'TSLA', name: 'Tesla, Inc.', exchange: 'NASDAQ', sector: 'Automotive', lastPrice: 213.1 },
  { symbol: 'AMZN', name: 'Amazon.com, Inc.', exchange: 'NASDAQ', sector: 'Consumer Discretionary', lastPrice: 182.5 },
  { symbol: 'META', name: 'Meta Platforms, Inc.', exchange: 'NASDAQ', sector: 'Communication Services', lastPrice: 509.0 },
  { symbol: 'GOOGL', name: 'Alphabet Inc.', exchange: 'NASDAQ', sector: 'Communication Services', lastPrice: 152.82 },
  { symbol: 'NFLX', name: 'Netflix, Inc.', exchange: 'NASDAQ', sector: 'Communication Services', lastPrice: 612.54 },
  { symbol: 'JPM', name: 'JPMorgan Chase & Co.', exchange: 'NYSE', sector: 'Financials', lastPrice: 198.43 },
  { symbol: 'V', name: 'Visa Inc.', exchange: 'NYSE', sector: 'Financials', lastPrice: 281.38 },
  { symbol: 'MA', name: 'Mastercard Incorporated', exchange: 'NYSE', sector: 'Financials', lastPrice: 472.25 },
  { symbol: 'WMT', name: 'Walmart Inc.', exchange: 'NYSE', sector: 'Consumer Staples', lastPrice: 64.27 },
  { symbol: 'KO', name: 'The Coca-Cola Company', exchange: 'NYSE', sector: 'Consumer Staples', lastPrice: 61.82 },
  { symbol: 'PEP', name: 'PepsiCo, Inc.', exchange: 'NASDAQ', sector: 'Consumer Staples', lastPrice: 168.14 },
  { symbol: 'XOM', name: 'Exxon Mobil Corporation', exchange: 'NYSE', sector: 'Energy', lastPrice: 112.43 },
  { symbol: 'CVX', name: 'Chevron Corporation', exchange: 'NYSE', sector: 'Energy', lastPrice: 156.27 },
  { symbol: 'UNH', name: 'UnitedHealth Group Incorporated', exchange: 'NYSE', sector: 'Healthcare', lastPrice: 521.75 },
  { symbol: 'PFE', name: 'Pfizer Inc.', exchange: 'NYSE', sector: 'Healthcare', lastPrice: 27.31 },
  { symbol: 'DIS', name: 'The Walt Disney Company', exchange: 'NYSE', sector: 'Communication Services', lastPrice: 108.72 },
  { symbol: 'BAC', name: 'Bank of America Corporation', exchange: 'NYSE', sector: 'Financials', lastPrice: 38.16 },
  { symbol: 'GS', name: 'The Goldman Sachs Group, Inc.', exchange: 'NYSE', sector: 'Financials', lastPrice: 412.31 },
  { symbol: 'C', name: 'Citigroup Inc.', exchange: 'NYSE', sector: 'Financials', lastPrice: 62.48 },
  { symbol: 'ADBE', name: 'Adobe Inc.', exchange: 'NASDAQ', sector: 'Technology', lastPrice: 544.63 },
  { symbol: 'CRM', name: 'Salesforce, Inc.', exchange: 'NYSE', sector: 'Technology', lastPrice: 296.54 },
  { symbol: 'ORCL', name: 'Oracle Corporation', exchange: 'NYSE', sector: 'Technology', lastPrice: 128.92 },
  { symbol: 'INTC', name: 'Intel Corporation', exchange: 'NASDAQ', sector: 'Semiconductors', lastPrice: 43.18 },
  { symbol: 'QCOM', name: 'QUALCOMM Incorporated', exchange: 'NASDAQ', sector: 'Semiconductors', lastPrice: 170.41 },
  { symbol: 'TXN', name: 'Texas Instruments Incorporated', exchange: 'NASDAQ', sector: 'Semiconductors', lastPrice: 187.35 },
  { symbol: 'AVGO', name: 'Broadcom Inc.', exchange: 'NASDAQ', sector: 'Semiconductors', lastPrice: 1289.77 },
  { symbol: 'COST', name: 'Costco Wholesale Corporation', exchange: 'NASDAQ', sector: 'Consumer Staples', lastPrice: 742.29 },
  { symbol: 'HD', name: 'The Home Depot, Inc.', exchange: 'NYSE', sector: 'Consumer Discretionary', lastPrice: 367.45 },
  { symbol: 'NKE', name: 'NIKE, Inc.', exchange: 'NYSE', sector: 'Consumer Discretionary', lastPrice: 102.63 },
  { symbol: 'MCD', name: "McDonald's Corporation", exchange: 'NYSE', sector: 'Consumer Discretionary', lastPrice: 286.94 },
  { symbol: 'SBUX', name: 'Starbucks Corporation', exchange: 'NASDAQ', sector: 'Consumer Discretionary', lastPrice: 94.26 },
  { symbol: 'CAT', name: 'Caterpillar Inc.', exchange: 'NYSE', sector: 'Industrials', lastPrice: 318.12 },
  { symbol: 'BA', name: 'The Boeing Company', exchange: 'NYSE', sector: 'Industrials', lastPrice: 197.33 },
  { symbol: 'GE', name: 'GE Aerospace', exchange: 'NYSE', sector: 'Industrials', lastPrice: 161.82 },
  { symbol: 'IBM', name: 'International Business Machines Corporation', exchange: 'NYSE', sector: 'Technology', lastPrice: 188.45 },
  { symbol: 'CSCO', name: 'Cisco Systems, Inc.', exchange: 'NASDAQ', sector: 'Technology', lastPrice: 50.17 },
  { symbol: 'TMO', name: 'Thermo Fisher Scientific Inc.', exchange: 'NYSE', sector: 'Healthcare', lastPrice: 571.93 },
  { symbol: 'ABBV', name: 'AbbVie Inc.', exchange: 'NYSE', sector: 'Healthcare', lastPrice: 171.44 },
  { symbol: 'JNJ', name: 'Johnson & Johnson', exchange: 'NYSE', sector: 'Healthcare', lastPrice: 161.57 },
  { symbol: 'MRK', name: 'Merck & Co., Inc.', exchange: 'NYSE', sector: 'Healthcare', lastPrice: 127.88 },
  { symbol: 'AMGN', name: 'Amgen Inc.', exchange: 'NASDAQ', sector: 'Healthcare', lastPrice: 301.76 },
  { symbol: 'GILD', name: 'Gilead Sciences, Inc.', exchange: 'NASDAQ', sector: 'Healthcare', lastPrice: 76.39 },
  { symbol: 'LLY', name: 'Eli Lilly and Company', exchange: 'NYSE', sector: 'Healthcare', lastPrice: 792.64 },
  { symbol: 'PG', name: 'The Procter & Gamble Company', exchange: 'NYSE', sector: 'Consumer Staples', lastPrice: 164.17 },
  { symbol: 'CL', name: 'Colgate-Palmolive Company', exchange: 'NYSE', sector: 'Consumer Staples', lastPrice: 89.23 },
  { symbol: 'KMB', name: 'Kimberly-Clark Corporation', exchange: 'NYSE', sector: 'Consumer Staples', lastPrice: 122.56 },
  { symbol: 'PM', name: 'Philip Morris International Inc.', exchange: 'NYSE', sector: 'Consumer Staples', lastPrice: 98.47 },
  { symbol: 'MO', name: 'Altria Group, Inc.', exchange: 'NYSE', sector: 'Consumer Staples', lastPrice: 44.72 },
  { symbol: 'UPS', name: 'United Parcel Service, Inc.', exchange: 'NYSE', sector: 'Industrials', lastPrice: 148.61 },
  { symbol: 'FDX', name: 'FedEx Corporation', exchange: 'NYSE', sector: 'Industrials', lastPrice: 254.13 },
  { symbol: 'RTX', name: 'RTX Corporation', exchange: 'NYSE', sector: 'Industrials', lastPrice: 96.85 },
  { symbol: 'LMT', name: 'Lockheed Martin Corporation', exchange: 'NYSE', sector: 'Industrials', lastPrice: 461.28 },
  { symbol: 'SPGI', name: 'S&P Global Inc.', exchange: 'NYSE', sector: 'Financials', lastPrice: 492.15 },
  { symbol: 'BLK', name: 'BlackRock, Inc.', exchange: 'NYSE', sector: 'Financials', lastPrice: 811.42 },
  { symbol: 'SCHW', name: 'The Charles Schwab Corporation', exchange: 'NYSE', sector: 'Financials', lastPrice: 71.63 },
  { symbol: 'PYPL', name: 'PayPal Holdings, Inc.', exchange: 'NASDAQ', sector: 'Financials', lastPrice: 64.77 },
];

const ensureCollection = async (Model) => {
  try {
    await Model.createCollection();
  } catch (error) {
    if (error.codeName !== 'NamespaceExists') {
      throw error;
    }
  }
};

const repairSessionTtlIndex = async () => {
  const indexes = await Session.collection.indexes();
  const expiresAtIndex = indexes.find((index) => index.name === 'expiresAt_1');

  if (!expiresAtIndex) {
    await Session.createIndexes();
    return;
  }

  if (typeof expiresAtIndex.expireAfterSeconds === 'number') {
    return;
  }

  await Session.collection.dropIndex('expiresAt_1');
  await Session.createIndexes();
  console.log('Repaired Session expiresAt index to TTL.');
};

const ensureCollectionsAndIndexes = async () => {
  for (const Model of models) {
    await ensureCollection(Model);
    try {
      await Model.createIndexes();
    } catch (error) {
      if (Model.modelName === 'Session' && error.codeName === 'IndexOptionsConflict') {
        await repairSessionTtlIndex();
      } else {
        throw error;
      }
    }
    console.log(`Ensured collection and indexes for ${Model.modelName}`);
  }
};

const backfillUsers = async () => {
  const [roleResult, isActiveResult] = await Promise.all([
    User.updateMany(
      {
        $or: [{ role: { $exists: false } }, { role: null }, { role: '' }],
      },
      { $set: { role: 'user' } }
    ),
    User.updateMany(
      {
        $or: [{ isActive: { $exists: false } }, { isActive: null }],
      },
      { $set: { isActive: true } }
    ),
  ]);

  console.log(`Users backfilled with role: ${roleResult.modifiedCount}`);
  console.log(`Users backfilled with isActive: ${isActiveResult.modifiedCount}`);
};

const backfillPortfolios = async () => {
  const portfolios = await Portfolio.find(
    {
      $or: [{ baseCashBalance: { $exists: false } }, { baseCashBalance: null }],
    },
    '_id cashBalance'
  ).lean();

  if (portfolios.length === 0) {
    console.log('No portfolio baseCashBalance backfill needed.');
    return;
  }

  const ops = portfolios.map((portfolio) => {
    const fallbackBalance =
      typeof portfolio.cashBalance === 'number' && portfolio.cashBalance >= 0
        ? portfolio.cashBalance
        : DEFAULT_BASE_CASH_BALANCE;
    return {
      updateOne: {
        filter: { _id: portfolio._id },
        update: { $set: { baseCashBalance: fallbackBalance } },
      },
    };
  });

  const result = await Portfolio.bulkWrite(ops, { ordered: false });
  console.log(`Portfolios backfilled with baseCashBalance: ${result.modifiedCount}`);
};

const seedDefaultStocks = async () => {
  if (!Array.isArray(DEFAULT_STOCKS) || DEFAULT_STOCKS.length === 0) {
    return;
  }

  const ops = DEFAULT_STOCKS.map((stock) => ({
    updateOne: {
      filter: { symbol: stock.symbol },
      update: {
        $setOnInsert: {
          symbol: stock.symbol,
          name: stock.name,
          exchange: stock.exchange,
          currency: 'USD',
          sector: stock.sector,
          lastPrice: stock.lastPrice,
          previousClose: stock.lastPrice,
          isActive: true,
        },
      },
      upsert: true,
    },
  }));

  const result = await Stock.bulkWrite(ops, { ordered: false });
  console.log(`Default stocks inserted: ${result.upsertedCount}`);
};

const seedPortfolioAndWatchlistForUsers = async () => {
  const users = await User.find({}, '_id').lean();

  if (users.length === 0) {
    console.log('No users found. Skipping portfolio/watchlist backfill.');
    return;
  }

  const portfolioOps = users.map(({ _id }) => ({
    updateOne: {
      filter: { user: _id },
      update: {
        $setOnInsert: {
          user: _id,
          baseCashBalance: DEFAULT_BASE_CASH_BALANCE,
          cashBalance: DEFAULT_BASE_CASH_BALANCE,
          holdings: [],
          totalInvested: 0,
          totalMarketValue: DEFAULT_BASE_CASH_BALANCE,
          realizedPnL: 0,
        },
      },
      upsert: true,
    },
  }));

  const watchlistOps = users.map(({ _id }) => ({
    updateOne: {
      filter: { user: _id },
      update: {
        $setOnInsert: {
          user: _id,
          items: [],
        },
      },
      upsert: true,
    },
  }));

  const [portfolioResult, watchlistResult] = await Promise.all([
    Portfolio.bulkWrite(portfolioOps, { ordered: false }),
    Watchlist.bulkWrite(watchlistOps, { ordered: false }),
  ]);

  console.log(`Portfolios created for users: ${portfolioResult.upsertedCount}`);
  console.log(`Watchlists created for users: ${watchlistResult.upsertedCount}`);
};

const rebuildAllPortfolios = async () => {
  const users = await User.find({}, '_id').lean();
  let rebuiltCount = 0;
  let failedCount = 0;

  for (const user of users) {
    try {
      await recalculatePortfolioFromTransactions(user._id);
      rebuiltCount += 1;
    } catch (error) {
      failedCount += 1;
      console.warn(`Portfolio rebuild failed for user ${user._id}: ${error.message}`);
    }
  }

  console.log(`Portfolios rebuilt: ${rebuiltCount}`);
  if (failedCount > 0) {
    console.warn(`Portfolios failed to rebuild: ${failedCount}`);
  }
};

const promoteDefaultAdmin = async () => {
  const adminEmail = process.env.DEFAULT_ADMIN_EMAIL?.trim().toLowerCase();
  if (!adminEmail) {
    return;
  }

  const result = await User.updateOne({ email: adminEmail }, { $set: { role: 'admin', isActive: true } });
  if (result.modifiedCount > 0 || result.matchedCount > 0) {
    console.log(`Default admin configured for ${adminEmail}`);
  } else {
    console.warn(`DEFAULT_ADMIN_EMAIL user not found: ${adminEmail}`);
  }
};

const reportBrokenTransactionLinks = async () => {
  const brokenCount = await Transaction.countDocuments({
    $or: [
      { user: { $exists: false } },
      { stock: { $exists: false } },
      { user: null },
      { stock: null },
    ],
  });

  if (brokenCount > 0) {
    console.warn(`Found ${brokenCount} transactions missing user/stock references.`);
  }
};

const runDbMigrations = async () => {
  try {
    await connectDB();
    await ensureCollectionsAndIndexes();
    await backfillUsers();
    await backfillPortfolios();
    await seedDefaultStocks();
    await seedPortfolioAndWatchlistForUsers();
    await promoteDefaultAdmin();
    await rebuildAllPortfolios();
    await reportBrokenTransactionLinks();

    console.log('Database migration completed successfully.');
    process.exitCode = 0;
  } catch (error) {
    console.error('Database migration failed:', error);
    process.exitCode = 1;
  } finally {
    await mongoose.connection.close();
  }
};

runDbMigrations();
