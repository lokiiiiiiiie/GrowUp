const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const Session = require('../models/Session');
const { parseCookieHeader } = require('../utils/cookies');
const { createHttpError } = require('../utils/httpError');

const REFRESH_COOKIE_NAME = 'growup_refresh_token';
const ACCESS_TOKEN_EXPIRES_IN = process.env.JWT_ACCESS_EXPIRES_IN || '15m';
const parsedRefreshDays = Number(process.env.JWT_REFRESH_DAYS || 14);
const REFRESH_DAYS = Number.isFinite(parsedRefreshDays) && parsedRefreshDays > 0 ? parsedRefreshDays : 14;
const REFRESH_TOKEN_TTL_MS = REFRESH_DAYS * 24 * 60 * 60 * 1000;

const getJwtSecret = () => {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET is not defined in environment variables');
  }

  return process.env.JWT_SECRET;
};

const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

const generateRefreshToken = () => crypto.randomBytes(64).toString('hex');

const createAccessToken = ({ userId, role, sessionId }) => {
  const payload = {
    sub: String(userId),
    role,
    sid: String(sessionId),
    type: 'access',
  };

  return jwt.sign(payload, getJwtSecret(), {
    expiresIn: ACCESS_TOKEN_EXPIRES_IN,
  });
};

const buildCookieOptions = () => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict',
  path: '/api/auth',
  maxAge: REFRESH_TOKEN_TTL_MS,
});

const setRefreshTokenCookie = (res, refreshToken) => {
  res.cookie(REFRESH_COOKIE_NAME, refreshToken, buildCookieOptions());
};

const clearRefreshTokenCookie = (res) => {
  res.clearCookie(REFRESH_COOKIE_NAME, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/api/auth',
  });
};

const readRefreshTokenFromRequest = (req) => {
  const cookies = parseCookieHeader(req.headers.cookie || '');
  return cookies[REFRESH_COOKIE_NAME] || null;
};

const createSession = async ({ user, req }) => {
  const refreshToken = generateRefreshToken();
  const refreshTokenHash = hashToken(refreshToken);
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_MS);

  const session = await Session.create({
    user: user._id,
    refreshTokenHash,
    userAgent: req.get('user-agent') || '',
    ipAddress: req.ip || '',
    expiresAt,
    revokedAt: null,
    lastUsedAt: new Date(),
  });

  return {
    session,
    refreshToken,
  };
};

const rotateSessionRefreshToken = async ({ session, req }) => {
  const refreshToken = generateRefreshToken();
  session.refreshTokenHash = hashToken(refreshToken);
  session.expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_MS);
  session.lastUsedAt = new Date();
  session.userAgent = req.get('user-agent') || session.userAgent || '';
  session.ipAddress = req.ip || session.ipAddress || '';
  session.revokedAt = null;
  await session.save();

  return refreshToken;
};

const revokeSessionByRefreshToken = async (refreshToken) => {
  if (!refreshToken) {
    return false;
  }

  const refreshTokenHash = hashToken(refreshToken);
  const session = await Session.findOne({ refreshTokenHash });

  if (!session) {
    return false;
  }

  if (!session.revokedAt) {
    session.revokedAt = new Date();
    await session.save();
  }

  return true;
};

const findValidSessionByRefreshToken = async (refreshToken) => {
  if (!refreshToken) {
    throw createHttpError(401, 'Refresh token is missing');
  }

  const refreshTokenHash = hashToken(refreshToken);
  const session = await Session.findOne({
    refreshTokenHash,
    revokedAt: null,
    expiresAt: { $gt: new Date() },
  }).populate('user');

  if (!session) {
    throw createHttpError(401, 'Invalid or expired refresh token');
  }

  if (!session.user || !session.user.isActive) {
    throw createHttpError(401, 'Session user is unavailable');
  }

  return session;
};

const revokeAllUserSessions = async (userId) => {
  const result = await Session.updateMany(
    { user: userId, revokedAt: null },
    { $set: { revokedAt: new Date() } }
  );
  return result.modifiedCount;
};

module.exports = {
  ACCESS_TOKEN_EXPIRES_IN,
  REFRESH_COOKIE_NAME,
  createAccessToken,
  setRefreshTokenCookie,
  clearRefreshTokenCookie,
  readRefreshTokenFromRequest,
  createSession,
  rotateSessionRefreshToken,
  revokeSessionByRefreshToken,
  findValidSessionByRefreshToken,
  revokeAllUserSessions,
};
