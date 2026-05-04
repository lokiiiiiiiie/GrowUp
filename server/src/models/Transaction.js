const { Schema, model } = require('mongoose');

const transactionSchema = new Schema(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    stock: {
      type: Schema.Types.ObjectId,
      ref: 'Stock',
      required: true,
      index: true,
    },
    portfolio: {
      type: Schema.Types.ObjectId,
      ref: 'Portfolio',
      index: true,
    },
    side: {
      type: String,
      enum: ['buy', 'sell'],
      required: true,
    },
    quantity: {
      type: Number,
      required: true,
      min: 0.000001,
    },
    price: {
      type: Number,
      required: true,
      min: 0,
    },
    fees: {
      type: Number,
      min: 0,
      default: 0,
    },
    totalAmount: {
      type: Number,
      min: 0,
      required: true,
      default: 0,
    },
    status: {
      type: String,
      enum: ['pending', 'filled', 'cancelled'],
      default: 'filled',
    },
    executedAt: {
      type: Date,
      default: Date.now,
    },
    note: {
      type: String,
      trim: true,
      maxlength: 280,
    },
  },
  {
    timestamps: true,
  }
);

transactionSchema.index({ user: 1, executedAt: -1 });
transactionSchema.index({ stock: 1, executedAt: -1 });
transactionSchema.index({ user: 1, stock: 1, executedAt: -1 });

transactionSchema.pre('validate', function calculateTotalAmount() {
  const quantity = Number(this.quantity) || 0;
  const price = Number(this.price) || 0;
  const fees = Number(this.fees) || 0;

  this.totalAmount = Number((quantity * price + fees).toFixed(2));
});

module.exports = model('Transaction', transactionSchema);
