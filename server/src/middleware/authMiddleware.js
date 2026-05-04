const jwt = require('jsonwebtoken');
const Session = require('../models/Session');
const User = require('../models/User');

const protect = async (req, res, next) => {
  const authHeader = req.headers.authorization || '';
  const hasBearerPrefix = authHeader.startsWith('Bearer ');
  const token = hasBearerPrefix ? authHeader.split(' ')[1] : null;

  if (!token) {
    return res.status(401).json({ message: 'Not authorized, token missing' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.type !== 'access' || !decoded.sub || !decoded.sid) {
      return res.status(401).json({ message: 'Not authorized, invalid access token' });
    }

    const [user, session] = await Promise.all([
      User.findById(decoded.sub).select('-password'),
      Session.findOne({
        _id: decoded.sid,
        user: decoded.sub,
        revokedAt: null,
        expiresAt: { $gt: new Date() },
      }).select('_id'),
    ]);

    if (!user) {
      return res.status(401).json({ message: 'Not authorized, user not found' });
    }

    if (!session) {
      return res.status(401).json({ message: 'Not authorized, session expired or revoked' });
    }

    if (!user.isActive) {
      return res.status(403).json({ message: 'Account is inactive' });
    }

    req.user = user;
    req.sessionId = session._id;
    return next();
  } catch (error) {
    return res.status(401).json({ message: 'Not authorized, invalid token' });
  }
};

const authorize = (...roles) => (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ message: 'Not authorized, user missing in request context' });
  }

  if (!roles.includes(req.user.role)) {
    return res.status(403).json({ message: 'Forbidden: insufficient role permissions' });
  }

  return next();
};

module.exports = { protect, authorize };
