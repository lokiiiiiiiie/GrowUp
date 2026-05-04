const Stock = require('../models/Stock');
const Watchlist = require('../models/Watchlist');
const { createHttpError } = require('../utils/httpError');
const {
  ensureObjectId,
  optionalString,
  parsePagination,
  requireString,
} = require('../utils/validation');

const canAccessWatchlist = (requestUser, watchlistUserId) =>
  requestUser.role === 'admin' || String(requestUser._id) === String(watchlistUserId);

const buildWatchlistResponse = (watchlist) => ({
  id: watchlist._id,
  user: watchlist.user,
  items: watchlist.items,
  createdAt: watchlist.createdAt,
  updatedAt: watchlist.updatedAt,
});

const ensureWatchlistForUser = async (userId) => {
  let watchlist = await Watchlist.findOne({ user: userId }).populate('items.stock', 'symbol name exchange');
  if (!watchlist) {
    watchlist = await Watchlist.create({ user: userId, items: [] });
  }
  return watchlist;
};

const listWatchlists = async (req, res, next) => {
  try {
    const { page, limit, skip } = parsePagination(req.query, 20, 100);
    const query = {};

    if (req.user.role !== 'admin') {
      query.user = req.user._id;
    } else if (req.query.userId) {
      query.user = ensureObjectId(req.query.userId, 'userId');
    }

    const [items, total] = await Promise.all([
      Watchlist.find(query)
        .populate('user', 'name email role')
        .populate('items.stock', 'symbol name exchange')
        .sort({ updatedAt: -1 })
        .skip(skip)
        .limit(limit),
      Watchlist.countDocuments(query),
    ]);

    res.status(200).json({
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
      items: items.map(buildWatchlistResponse),
    });
  } catch (error) {
    next(error);
  }
};

const createWatchlist = async (req, res, next) => {
  try {
    const userId =
      req.user.role === 'admin' && req.body.userId ? ensureObjectId(req.body.userId, 'userId') : req.user._id;

    const existing = await Watchlist.findOne({ user: userId }).populate('items.stock', 'symbol name exchange');
    if (existing) {
      return res.status(200).json({ watchlist: buildWatchlistResponse(existing) });
    }

    const watchlist = await Watchlist.create({ user: userId, items: [] });
    await watchlist.populate('items.stock', 'symbol name exchange');
    return res.status(201).json({ watchlist: buildWatchlistResponse(watchlist) });
  } catch (error) {
    return next(error);
  }
};

const getCurrentWatchlist = async (req, res, next) => {
  try {
    const watchlist = await ensureWatchlistForUser(req.user._id);
    await watchlist.populate('items.stock', 'symbol name exchange currency');
    res.status(200).json({ watchlist: buildWatchlistResponse(watchlist) });
  } catch (error) {
    next(error);
  }
};

const getWatchlistById = async (req, res, next) => {
  try {
    const watchlistId = ensureObjectId(req.params.id, 'Watchlist id');
    const watchlist = await Watchlist.findById(watchlistId)
      .populate('user', 'name email role')
      .populate('items.stock', 'symbol name exchange currency');

    if (!watchlist) {
      throw createHttpError(404, 'Watchlist not found');
    }

    if (!canAccessWatchlist(req.user, watchlist.user._id || watchlist.user)) {
      throw createHttpError(403, 'Forbidden: cannot access this watchlist');
    }

    res.status(200).json({ watchlist: buildWatchlistResponse(watchlist) });
  } catch (error) {
    next(error);
  }
};

const replaceCurrentWatchlist = async (req, res, next) => {
  try {
    const watchlist = await ensureWatchlistForUser(req.user._id);
    const items = Array.isArray(req.body.items) ? req.body.items : null;

    if (!items) {
      throw createHttpError(400, 'items array is required');
    }

    const nextItems = [];
    const seenStockIds = new Set();

    for (const item of items) {
      const stockId = ensureObjectId(item.stockId, 'stockId');
      if (seenStockIds.has(stockId)) {
        throw createHttpError(400, 'Duplicate stockId found in items');
      }

      const stockExists = await Stock.exists({ _id: stockId });
      if (!stockExists) {
        throw createHttpError(404, `Stock not found: ${stockId}`);
      }

      seenStockIds.add(stockId);
      nextItems.push({
        stock: stockId,
        note: optionalString(item.note, 'note', 280) || '',
        addedAt: item.addedAt ? new Date(item.addedAt) : new Date(),
      });
    }

    watchlist.items = nextItems;
    await watchlist.save();
    await watchlist.populate('items.stock', 'symbol name exchange currency');

    res.status(200).json({ watchlist: buildWatchlistResponse(watchlist) });
  } catch (error) {
    next(error);
  }
};

const addWatchlistItem = async (req, res, next) => {
  try {
    const watchlist = await ensureWatchlistForUser(req.user._id);
    const stockId = ensureObjectId(req.body.stockId, 'stockId');
    const note = optionalString(req.body.note, 'note', 280);

    const stock = await Stock.findById(stockId);
    if (!stock) {
      throw createHttpError(404, 'Stock not found');
    }

    const alreadyPresent = watchlist.items.some((item) => String(item.stock) === stockId);
    if (alreadyPresent) {
      throw createHttpError(409, 'Stock already exists in watchlist');
    }

    watchlist.items.push({
      stock: stock._id,
      note: note || '',
      addedAt: new Date(),
    });

    await watchlist.save();
    await watchlist.populate('items.stock', 'symbol name exchange currency');

    res.status(201).json({ watchlist: buildWatchlistResponse(watchlist) });
  } catch (error) {
    next(error);
  }
};

const updateWatchlistItem = async (req, res, next) => {
  try {
    const watchlist = await ensureWatchlistForUser(req.user._id);
    const stockId = ensureObjectId(req.params.stockId, 'stockId');
    const note = requireString(req.body.note, 'note', 280);

    const item = watchlist.items.find((entry) => String(entry.stock) === stockId);
    if (!item) {
      throw createHttpError(404, 'Stock is not in watchlist');
    }

    item.note = note;
    await watchlist.save();
    await watchlist.populate('items.stock', 'symbol name exchange currency');
    res.status(200).json({ watchlist: buildWatchlistResponse(watchlist) });
  } catch (error) {
    next(error);
  }
};

const removeWatchlistItem = async (req, res, next) => {
  try {
    const watchlist = await ensureWatchlistForUser(req.user._id);
    const stockId = ensureObjectId(req.params.stockId, 'stockId');

    const previousCount = watchlist.items.length;
    watchlist.items = watchlist.items.filter((item) => String(item.stock) !== stockId);

    if (watchlist.items.length === previousCount) {
      throw createHttpError(404, 'Stock is not in watchlist');
    }

    await watchlist.save();
    await watchlist.populate('items.stock', 'symbol name exchange currency');
    res.status(200).json({ watchlist: buildWatchlistResponse(watchlist) });
  } catch (error) {
    next(error);
  }
};

const deleteCurrentWatchlist = async (req, res, next) => {
  try {
    await Watchlist.deleteOne({ user: req.user._id });
    res.status(200).json({ message: 'Watchlist deleted successfully' });
  } catch (error) {
    next(error);
  }
};

const replaceWatchlistById = async (req, res, next) => {
  try {
    const watchlistId = ensureObjectId(req.params.id, 'Watchlist id');
    const watchlist = await Watchlist.findById(watchlistId);

    if (!watchlist) {
      throw createHttpError(404, 'Watchlist not found');
    }

    if (!canAccessWatchlist(req.user, watchlist.user)) {
      throw createHttpError(403, 'Forbidden: cannot update this watchlist');
    }

    const items = Array.isArray(req.body.items) ? req.body.items : null;
    if (!items) {
      throw createHttpError(400, 'items array is required');
    }

    const nextItems = [];
    const seenStockIds = new Set();

    for (const item of items) {
      const stockId = ensureObjectId(item.stockId, 'stockId');
      if (seenStockIds.has(stockId)) {
        throw createHttpError(400, 'Duplicate stockId found in items');
      }

      const stockExists = await Stock.exists({ _id: stockId });
      if (!stockExists) {
        throw createHttpError(404, `Stock not found: ${stockId}`);
      }

      seenStockIds.add(stockId);
      nextItems.push({
        stock: stockId,
        note: optionalString(item.note, 'note', 280) || '',
        addedAt: item.addedAt ? new Date(item.addedAt) : new Date(),
      });
    }

    watchlist.items = nextItems;
    await watchlist.save();
    await watchlist.populate('items.stock', 'symbol name exchange currency');
    res.status(200).json({ watchlist: buildWatchlistResponse(watchlist) });
  } catch (error) {
    next(error);
  }
};

const deleteWatchlistById = async (req, res, next) => {
  try {
    const watchlistId = ensureObjectId(req.params.id, 'Watchlist id');
    const watchlist = await Watchlist.findById(watchlistId);

    if (!watchlist) {
      throw createHttpError(404, 'Watchlist not found');
    }

    if (!canAccessWatchlist(req.user, watchlist.user)) {
      throw createHttpError(403, 'Forbidden: cannot delete this watchlist');
    }

    await watchlist.deleteOne();
    res.status(200).json({ message: 'Watchlist deleted successfully' });
  } catch (error) {
    next(error);
  }
};

module.exports = {
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
};
