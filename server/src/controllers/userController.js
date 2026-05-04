const User = require('../models/User');
const Watchlist = require('../models/Watchlist');
const { revokeAllUserSessions } = require('../services/sessionService');
const { createHttpError } = require('../utils/httpError');
const {
  ensureObjectId,
  normalizeEmail,
  parseBoolean,
  parseEnum,
  parsePagination,
  requireString,
} = require('../utils/validation');
const { DEFAULT_BASE_CASH_BALANCE, ensurePortfolioForUser } = require('../services/portfolioService');
const { deleteUserAndAssociations } = require('../services/userService');

const buildUserResponse = (user) => ({
  id: user._id,
  name: user.name,
  email: user.email,
  role: user.role,
  isActive: user.isActive,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
});

const canAccessUser = (requestUser, targetUserId) =>
  requestUser.role === 'admin' || String(requestUser._id) === String(targetUserId);

const listUsers = async (req, res, next) => {
  try {
    const { page, limit, skip } = parsePagination(req.query, 20, 100);
    const query = {};

    if (req.query.search) {
      const term = req.query.search.trim();
      const searchRegex = new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      query.$or = [{ name: searchRegex }, { email: searchRegex }];
    }

    if (req.query.role) {
      query.role = parseEnum(req.query.role, 'role', ['user', 'admin']);
    }

    if (req.query.isActive !== undefined) {
      query.isActive = parseBoolean(req.query.isActive, 'isActive');
    }

    const [users, total] = await Promise.all([
      User.find(query).select('-password').sort({ createdAt: -1 }).skip(skip).limit(limit),
      User.countDocuments(query),
    ]);

    res.status(200).json({
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
      items: users.map(buildUserResponse),
    });
  } catch (error) {
    next(error);
  }
};

const createUser = async (req, res, next) => {
  try {
    const name = requireString(req.body.name, 'Name', 80);
    const email = normalizeEmail(req.body.email);
    const password = requireString(req.body.password, 'Password', 128);
    const role = parseEnum(req.body.role || 'user', 'role', ['user', 'admin']);
    const isActive = req.body.isActive === undefined ? true : parseBoolean(req.body.isActive, 'isActive', true);

    if (password.length < 6) {
      throw createHttpError(400, 'Password must be at least 6 characters');
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      throw createHttpError(409, 'A user with this email already exists');
    }

    const user = await User.create({
      name,
      email,
      password,
      role,
      isActive,
    });

    await Promise.all([
      ensurePortfolioForUser(user._id, { baseCashBalance: DEFAULT_BASE_CASH_BALANCE }),
      Watchlist.updateOne({ user: user._id }, { $setOnInsert: { user: user._id, items: [] } }, { upsert: true }),
    ]);

    res.status(201).json({ user: buildUserResponse(user) });
  } catch (error) {
    next(error);
  }
};

const getCurrentUserProfile = async (req, res) => {
  res.status(200).json({ user: buildUserResponse(req.user) });
};

const getUserById = async (req, res, next) => {
  try {
    const userId = ensureObjectId(req.params.id, 'User id');

    if (!canAccessUser(req.user, userId)) {
      throw createHttpError(403, 'Forbidden: cannot access this user');
    }

    const user = await User.findById(userId).select('-password');
    if (!user) {
      throw createHttpError(404, 'User not found');
    }

    res.status(200).json({ user: buildUserResponse(user) });
  } catch (error) {
    next(error);
  }
};

const updateUser = async (req, res, next) => {
  try {
    const userId = ensureObjectId(req.params.id, 'User id');
    if (!canAccessUser(req.user, userId)) {
      throw createHttpError(403, 'Forbidden: cannot update this user');
    }

    const user = await User.findById(userId);
    if (!user) {
      throw createHttpError(404, 'User not found');
    }

    if (req.body.name !== undefined) {
      user.name = requireString(req.body.name, 'Name', 80);
    }

    if (req.body.email !== undefined) {
      user.email = normalizeEmail(req.body.email);
    }

    if (req.body.password !== undefined) {
      const password = requireString(req.body.password, 'Password', 128);
      if (password.length < 6) {
        throw createHttpError(400, 'Password must be at least 6 characters');
      }
      user.password = password;
    }

    if (req.body.role !== undefined) {
      if (req.user.role !== 'admin') {
        throw createHttpError(403, 'Only admins can change user roles');
      }
      const nextRole = parseEnum(req.body.role, 'role', ['user', 'admin']);
      if (user.role === 'admin' && nextRole !== 'admin') {
        const adminCount = await User.countDocuments({ role: 'admin', isActive: true });
        if (adminCount <= 1 && user.isActive) {
          throw createHttpError(400, 'Cannot demote the last active admin account');
        }
      }
      user.role = nextRole;
    }

    if (req.body.isActive !== undefined) {
      if (req.user.role !== 'admin') {
        throw createHttpError(403, 'Only admins can change user activation status');
      }
      const nextIsActive = parseBoolean(req.body.isActive, 'isActive', true);
      if (user.role === 'admin' && user.isActive && !nextIsActive) {
        const adminCount = await User.countDocuments({ role: 'admin', isActive: true });
        if (adminCount <= 1) {
          throw createHttpError(400, 'Cannot deactivate the last active admin account');
        }
      }
      user.isActive = nextIsActive;
    }

    await user.save();

    if (!user.isActive) {
      await revokeAllUserSessions(user._id);
    }

    res.status(200).json({ user: buildUserResponse(user) });
  } catch (error) {
    if (error.code === 11000) {
      res.status(409);
      return next(new Error('A user with this email already exists'));
    }
    return next(error);
  }
};

const deleteUser = async (req, res, next) => {
  try {
    const userId = ensureObjectId(req.params.id, 'User id');
    if (!canAccessUser(req.user, userId)) {
      throw createHttpError(403, 'Forbidden: cannot delete this user');
    }

    const user = await User.findById(userId).select('_id role');
    if (!user) {
      throw createHttpError(404, 'User not found');
    }

    if (user.role === 'admin') {
      const adminCount = await User.countDocuments({ role: 'admin', isActive: true });
      if (adminCount <= 1) {
        throw createHttpError(400, 'Cannot delete the last active admin account');
      }
    }

    await deleteUserAndAssociations(userId);
    res.status(200).json({ message: 'User deleted successfully' });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  listUsers,
  createUser,
  getCurrentUserProfile,
  getUserById,
  updateUser,
  deleteUser,
};
