const User = require('../models/User');
const Portfolio = require('../models/Portfolio');
const Watchlist = require('../models/Watchlist');
const { DEFAULT_BASE_CASH_BALANCE } = require('../services/portfolioService');
const {
  ACCESS_TOKEN_EXPIRES_IN,
  clearRefreshTokenCookie,
  createAccessToken,
  createSession,
  findValidSessionByRefreshToken,
  readRefreshTokenFromRequest,
  revokeAllUserSessions,
  revokeSessionByRefreshToken,
  rotateSessionRefreshToken,
  setRefreshTokenCookie,
} = require('../services/sessionService');
const { normalizeEmail, requireString } = require('../utils/validation');
const { createHttpError } = require('../utils/httpError');

const createAuthResponse = ({ user, sessionId }) => ({
  user: {
    id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
  },
  tokenType: 'Bearer',
  expiresIn: ACCESS_TOKEN_EXPIRES_IN,
  token: createAccessToken({
    userId: user._id,
    role: user.role,
    sessionId,
  }),
});

const registerUser = async (req, res, next) => {
  try {
    const name = requireString(req.body.name, 'Name', 80);
    const normalizedEmail = normalizeEmail(req.body.email);
    const password = requireString(req.body.password, 'Password', 128);

    if (password.length < 6) {
      res.status(400);
      throw new Error('Password must be at least 6 characters');
    }

    const existingUser = await User.findOne({ email: normalizedEmail });

    if (existingUser) {
      res.status(409);
      throw new Error('A user with this email already exists');
    }

    const user = await User.create({
      name,
      email: normalizedEmail,
      password,
    });

    await Promise.all([
      Portfolio.updateOne(
        { user: user._id },
        {
          $setOnInsert: {
            user: user._id,
            baseCashBalance: DEFAULT_BASE_CASH_BALANCE,
            cashBalance: DEFAULT_BASE_CASH_BALANCE,
            holdings: [],
            totalInvested: 0,
            totalMarketValue: DEFAULT_BASE_CASH_BALANCE,
            realizedPnL: 0,
          },
        },
        { upsert: true }
      ),
      Watchlist.updateOne(
        { user: user._id },
        { $setOnInsert: { user: user._id, items: [] } },
        { upsert: true }
      ),
    ]);

    const { session, refreshToken } = await createSession({ user, req });
    setRefreshTokenCookie(res, refreshToken);

    res.status(201).json(
      createAuthResponse({
        user,
        sessionId: session._id,
      })
    );
  } catch (error) {
    next(error);
  }
};

const loginUser = async (req, res, next) => {
  try {
    const normalizedEmail = normalizeEmail(req.body.email);
    const password = requireString(req.body.password, 'Password', 128);
    const user = await User.findOne({ email: normalizedEmail });

    if (user && !user.isActive) {
      res.status(403);
      throw new Error('Account is inactive');
    }

    if (!user || !(await user.matchPassword(password))) {
      res.status(401);
      throw new Error('Invalid email or password');
    }

    const { session, refreshToken } = await createSession({ user, req });
    setRefreshTokenCookie(res, refreshToken);

    res.status(200).json(
      createAuthResponse({
        user,
        sessionId: session._id,
      })
    );
  } catch (error) {
    next(error);
  }
};

const refreshSession = async (req, res, next) => {
  try {
    const refreshToken = readRefreshTokenFromRequest(req);
    const session = await findValidSessionByRefreshToken(refreshToken);

    const nextRefreshToken = await rotateSessionRefreshToken({ session, req });
    setRefreshTokenCookie(res, nextRefreshToken);

    res.status(200).json(
      createAuthResponse({
        user: session.user,
        sessionId: session._id,
      })
    );
  } catch (error) {
    clearRefreshTokenCookie(res);
    next(error);
  }
};

const logoutUser = async (req, res, next) => {
  try {
    const refreshToken = readRefreshTokenFromRequest(req);
    await revokeSessionByRefreshToken(refreshToken);
    clearRefreshTokenCookie(res);
    res.status(200).json({ message: 'Logged out successfully' });
  } catch (error) {
    next(error);
  }
};

const logoutAllSessions = async (req, res, next) => {
  try {
    if (!req.user?._id) {
      throw createHttpError(401, 'Not authorized');
    }

    const revokedCount = await revokeAllUserSessions(req.user._id);
    clearRefreshTokenCookie(res);
    res.status(200).json({
      message: 'All sessions revoked successfully',
      revokedCount,
    });
  } catch (error) {
    next(error);
  }
};

const getCurrentUser = async (req, res) => {
  res.status(200).json({
    user: {
      id: req.user._id,
      name: req.user.name,
      email: req.user.email,
      role: req.user.role,
    },
  });
};

module.exports = {
  registerUser,
  loginUser,
  refreshSession,
  logoutUser,
  logoutAllSessions,
  getCurrentUser,
};
