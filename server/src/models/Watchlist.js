const { Schema, model } = require('mongoose');

const watchlistItemSchema = new Schema(
  {
    stock: {
      type: Schema.Types.ObjectId,
      ref: 'Stock',
      required: true,
    },
    note: {
      type: String,
      trim: true,
      maxlength: 280,
    },
    addedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    _id: false,
  }
);

const watchlistSchema = new Schema(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true,
    },
    items: {
      type: [watchlistItemSchema],
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

watchlistSchema.path('items').validate(function validateUniqueItems(items) {
  const stockIds = (items || []).map((item) => String(item.stock));
  return new Set(stockIds).size === stockIds.length;
}, 'Watchlist cannot contain duplicate stocks');

watchlistSchema.index({ 'items.stock': 1 });

module.exports = model('Watchlist', watchlistSchema);
