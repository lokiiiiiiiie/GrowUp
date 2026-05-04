const express = require('express');
const {
  listUsers,
  createUser,
  getCurrentUserProfile,
  getUserById,
  updateUser,
  deleteUser,
} = require('../controllers/userController');
const { protect, authorize } = require('../middleware/authMiddleware');

const router = express.Router();

router.use(protect);

router.get('/me', getCurrentUserProfile);
router.route('/').get(authorize('admin'), listUsers).post(authorize('admin'), createUser);
router.route('/:id').get(getUserById).put(updateUser).delete(deleteUser);

module.exports = router;
