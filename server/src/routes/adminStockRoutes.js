const express = require('express');
const {
  listStocks,
  getStockById,
  createStock,
  updateStock,
  deleteStock,
} = require('../controllers/stockController');
const { protect, authorize } = require('../middleware/authMiddleware');

const router = express.Router();

router.use(protect);
router.use(authorize('admin'));

router.route('/').get(listStocks).post(createStock);
router.route('/:id').get(getStockById).put(updateStock).delete(deleteStock);

module.exports = router;
