const express = require('express');
const {
  listPortfolios,
  createPortfolio,
  getCurrentPortfolio,
  getPortfolioById,
  updateCurrentPortfolio,
  updatePortfolioById,
  deleteCurrentPortfolio,
  deletePortfolioById,
} = require('../controllers/portfolioController');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

router.use(protect);

router.route('/').get(listPortfolios).post(createPortfolio);
router.route('/me').get(getCurrentPortfolio).patch(updateCurrentPortfolio).delete(deleteCurrentPortfolio);
router.route('/:id').get(getPortfolioById).patch(updatePortfolioById).delete(deletePortfolioById);

module.exports = router;
