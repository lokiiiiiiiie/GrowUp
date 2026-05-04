const { Schema, model } = require('mongoose');

const holdingSchema = new Schema(
  {
    stock: {
      type: Schema.Types.ObjectId,
      ref: 'Stock',
      required: true,
    },
    quantity: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    averagePrice: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    marketPrice: {
      type: Number,
      min: 0,
      default: 0,
    },
    marketValue: {
      type: Number,
      min: 0,
      default: 0,
    },
  },
  {
    _id: false,
  }
);

const portfolioSchema = new Schema(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true,
    },
    baseCashBalance: {
      type: Number,
      required: true,
      min: 0,
      default: 100000,
    },
    cashBalance: {
      type: Number,
      required: true,
      default: 100000,
    },
    holdings: {
      type: [holdingSchema],
      default: [],
    },
    totalInvested: {
      type: Number,
      min: 0,
      default: 0,
    },
    totalMarketValue: {
      type: Number,
      min: 0,
      default: 0,
    },
    realizedPnL: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

portfolioSchema.path('holdings').validate(function validateUniqueHoldings(holdings) {
  const stockIds = (holdings || []).map((holding) => String(holding.stock));
  return new Set(stockIds).size === stockIds.length;
}, 'Portfolio holdings cannot contain duplicate stocks');

portfolioSchema.pre('validate', function normalizePortfolio() {
  if (!Array.isArray(this.holdings)) {
    this.holdings = [];
  }

  if (this.baseCashBalance === undefined || this.baseCashBalance === null) {
    this.baseCashBalance = 100000;
  }

  let investedValue = 0;
  let holdingsMarketValue = 0;

  this.holdings = this.holdings.map((holding) => {
    const quantity = Number(holding.quantity) || 0;
    const averagePrice = Number(holding.averagePrice) || 0;
    const marketPrice = Number(holding.marketPrice || averagePrice) || 0;
    const marketValue = quantity * marketPrice;

    investedValue += quantity * averagePrice;
    holdingsMarketValue += marketValue;

    return {
      stock: holding.stock,
      quantity,
      averagePrice,
      marketPrice,
      marketValue: Number(marketValue.toFixed(2)),
    };
  });

  this.totalInvested = Number(investedValue.toFixed(2));
  this.totalMarketValue = Number((holdingsMarketValue + (Number(this.cashBalance) || 0)).toFixed(2));
});

module.exports = model('Portfolio', portfolioSchema);
