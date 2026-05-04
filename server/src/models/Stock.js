const { Schema, model } = require('mongoose');

const stockSchema = new Schema(
  {
    symbol: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
      unique: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    exchange: {
      type: String,
      trim: true,
      default: 'NASDAQ',
    },
    currency: {
      type: String,
      uppercase: true,
      trim: true,
      default: 'USD',
    },
    sector: {
      type: String,
      trim: true,
      default: 'Unknown',
    },
    lastPrice: {
      type: Number,
      min: 0,
      default: 0,
    },
    previousClose: {
      type: Number,
      min: 0,
      default: 0,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = model('Stock', stockSchema);
