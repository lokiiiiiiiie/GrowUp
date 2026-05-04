const express = require('express');
const {
  listStocks,
  getStockById,
  createStock,
  updateStock,
  deleteStock,
  getStockQuotes,
  streamStockQuotes,
} = require('../controllers/stockController');
const { protect, authorize } = require('../middleware/authMiddleware');

const router = express.Router();

router.use(protect);

router.get('/quotes', getStockQuotes);
router.get('/quotes/stream', streamStockQuotes);
router.route('/').get(listStocks).post(authorize('admin'), createStock);
router.route('/:id').get(getStockById).put(authorize('admin'), updateStock).delete(authorize('admin'), deleteStock);

module.exports = router;
