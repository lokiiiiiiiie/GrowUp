const { Types } = require('mongoose');
const { createHttpError } = require('./httpError');

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const asTrimmedString = (value) => (typeof value === 'string' ? value.trim() : '');

const requireString = (value, fieldName, maxLength = 200) => {
  const text = asTrimmedString(value);

  if (!text) {
    throw createHttpError(400, `${fieldName} is required`);
  }

  if (text.length > maxLength) {
    throw createHttpError(400, `${fieldName} must be at most ${maxLength} characters`);
  }

  return text;
};

const optionalString = (value, fieldName, maxLength = 200) => {
  if (value === undefined || value === null) {
    return undefined;
  }

  const text = asTrimmedString(value);
  if (!text) {
    return '';
  }

  if (text.length > maxLength) {
    throw createHttpError(400, `${fieldName} must be at most ${maxLength} characters`);
  }

  return text;
};

const normalizeEmail = (value, required = true) => {
  const email = asTrimmedString(value).toLowerCase();

  if (!email) {
    if (required) {
      throw createHttpError(400, 'Email is required');
    }

    return undefined;
  }

  if (!EMAIL_PATTERN.test(email)) {
    throw createHttpError(400, 'Email format is invalid');
  }

  return email;
};

const ensureObjectId = (value, fieldName) => {
  const objectId = asTrimmedString(value);

  if (!objectId) {
    throw createHttpError(400, `${fieldName} is required`);
  }

  if (!Types.ObjectId.isValid(objectId)) {
    throw createHttpError(400, `${fieldName} is invalid`);
  }

  return objectId;
};

const optionalObjectId = (value, fieldName) => {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  return ensureObjectId(value, fieldName);
};

const parseNumber = (value, fieldName, options = {}) => {
  const {
    required = true,
    min = Number.NEGATIVE_INFINITY,
    max = Number.POSITIVE_INFINITY,
    integer = false,
  } = options;

  if (value === undefined || value === null || value === '') {
    if (required) {
      throw createHttpError(400, `${fieldName} is required`);
    }

    return undefined;
  }

  const number = Number(value);
  if (!Number.isFinite(number)) {
    throw createHttpError(400, `${fieldName} must be a valid number`);
  }

  if (integer && !Number.isInteger(number)) {
    throw createHttpError(400, `${fieldName} must be an integer`);
  }

  if (number < min) {
    throw createHttpError(400, `${fieldName} must be at least ${min}`);
  }

  if (number > max) {
    throw createHttpError(400, `${fieldName} must be at most ${max}`);
  }

  return number;
};

const parseEnum = (value, fieldName, allowedValues, required = true) => {
  if (value === undefined || value === null || value === '') {
    if (required) {
      throw createHttpError(400, `${fieldName} is required`);
    }

    return undefined;
  }

  if (!allowedValues.includes(value)) {
    throw createHttpError(400, `${fieldName} must be one of: ${allowedValues.join(', ')}`);
  }

  return value;
};

const parseBoolean = (value, fieldName, required = false) => {
  if (value === undefined || value === null || value === '') {
    if (required) {
      throw createHttpError(400, `${fieldName} is required`);
    }

    return undefined;
  }

  if (typeof value === 'boolean') {
    return value;
  }

  if (value === 'true') {
    return true;
  }

  if (value === 'false') {
    return false;
  }

  throw createHttpError(400, `${fieldName} must be true or false`);
};

const parseDate = (value, fieldName, required = false) => {
  if (value === undefined || value === null || value === '') {
    if (required) {
      throw createHttpError(400, `${fieldName} is required`);
    }

    return undefined;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw createHttpError(400, `${fieldName} must be a valid date`);
  }

  return date;
};

const parsePagination = (query = {}, defaultLimit = 20, maxLimit = 100) => {
  const page = parseNumber(query.page, 'page', {
    required: false,
    min: 1,
    integer: true,
  }) || 1;
  const limit = parseNumber(query.limit, 'limit', {
    required: false,
    min: 1,
    max: maxLimit,
    integer: true,
  }) || defaultLimit;

  return {
    page,
    limit,
    skip: (page - 1) * limit,
  };
};

module.exports = {
  requireString,
  optionalString,
  normalizeEmail,
  ensureObjectId,
  optionalObjectId,
  parseNumber,
  parseEnum,
  parseBoolean,
  parseDate,
  parsePagination,
};
