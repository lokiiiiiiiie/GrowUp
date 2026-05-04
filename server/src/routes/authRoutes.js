const express = require('express');
const {
  registerUser,
  loginUser,
  refreshSession,
  logoutUser,
  logoutAllSessions,
  getCurrentUser,
} = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

router.post('/register', registerUser);
router.post('/login', loginUser);
router.post('/refresh', refreshSession);
router.post('/logout', logoutUser);
router.post('/logout-all', protect, logoutAllSessions);
router.get('/me', protect, getCurrentUser);

module.exports = router;
