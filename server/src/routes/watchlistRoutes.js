const express = require('express');
const {
  listWatchlists,
  createWatchlist,
  getCurrentWatchlist,
  getWatchlistById,
  replaceCurrentWatchlist,
  addWatchlistItem,
  updateWatchlistItem,
  removeWatchlistItem,
  deleteCurrentWatchlist,
  replaceWatchlistById,
  deleteWatchlistById,
} = require('../controllers/watchlistController');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

router.use(protect);

router.route('/').get(listWatchlists).post(createWatchlist);
router.route('/me').get(getCurrentWatchlist).put(replaceCurrentWatchlist).delete(deleteCurrentWatchlist);
router.route('/me/items').post(addWatchlistItem);
router.route('/me/items/:stockId').patch(updateWatchlistItem).delete(removeWatchlistItem);
router.route('/:id').get(getWatchlistById).put(replaceWatchlistById).delete(deleteWatchlistById);

module.exports = router;
