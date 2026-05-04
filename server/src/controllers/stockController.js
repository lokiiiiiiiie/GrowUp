const https = require('https');
const Stock = require('../models/Stock');
const Transaction = require('../models/Transaction');
const { createHttpError } = require('../utils/httpError');
const {
  ensureObjectId,
  optionalString,
  parseBoolean,
  parseNumber,
  parsePagination,
  requireString,
} = require('../utils/validation');

const DEFAULT_QUOTE_LIMIT = 20;
const MAX_QUOTE_LIMIT = 100;
const DEFAULT_STREAM_INTERVAL_MS = 5000;
const MIN_STREAM_INTERVAL_MS = 1000;
const MAX_STREAM_INTERVAL_MS = 60000;
const fallbackQuoteState = new Map();
const QUOTE_REQUEST_TIMEOUT_MS = 10000;
const FINNHUB_BATCH_SIZE = 8;
const YAHOO_REQUEST_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123 Safari/537.36',
  Accept: 'application/json',
};

const buildStockResponse = (stock) => ({
  id: stock._id,
  symbol: stock.symbol,
  name: stock.name,
  exchange: stock.exchange,
  currency: stock.currency,
  sector: stock.sector,
  lastPrice: stock.lastPrice,
  previousClose: stock.previousClose,
  isActive: stock.isActive,
  createdAt: stock.createdAt,
  updatedAt: stock.updatedAt,
});

const getJson = (url, options = {}) =>
  new Promise((resolve, reject) => {
    const request = https.get(
      url,
      {
        headers: options.headers || {},
        timeout: options.timeoutMs || QUOTE_REQUEST_TIMEOUT_MS,
      },
      (response) => {
        const { statusCode } = response;
        let body = '';

        response.on('data', (chunk) => {
          body += chunk;
        });

        response.on('end', () => {
          if (statusCode < 200 || statusCode >= 300) {
            reject(new Error(`Quote API returned HTTP ${statusCode}`));
            return;
          }

          try {
            resolve(JSON.parse(body));
          } catch (_error) {
            reject(new Error('Quote API returned invalid JSON'));
          }
        });
      }
    );

    request.on('timeout', () => {
      request.destroy(new Error('Quote API request timed out'));
    });

    request.on('error', (error) => reject(error));
  });

const toNumber = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

const chunkArray = (items, size) => {
  const chunks = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
};

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const parseSymbols = (rawSymbols) => {
  if (!rawSymbols || typeof rawSymbols !== 'string') {
    return [];
  }

  const symbols = rawSymbols
    .split(',')
    .map((item) => item.trim().toUpperCase())
    .filter(Boolean);

  return Array.from(new Set(symbols));
};

const resolveStocksForQuotes = async (query = {}) => {
  const symbols = parseSymbols(query.symbols);
  const limit =
    parseNumber(query.limit, 'limit', {
      required: false,
      min: 1,
      max: MAX_QUOTE_LIMIT,
      integer: true,
    }) || DEFAULT_QUOTE_LIMIT;

  if (symbols.length > 0) {
    const stocks = await Stock.find({
      symbol: { $in: symbols },
      isActive: true,
    });

    const map = new Map(stocks.map((stock) => [stock.symbol, stock]));
    return symbols.map((symbol) => map.get(symbol)).filter(Boolean).slice(0, MAX_QUOTE_LIMIT);
  }

  const findQuery = { isActive: true };

  if (query.search) {
    const term = query.search.trim();
    const searchRegex = new RegExp(escapeRegex(term), 'i');
    findQuery.$or = [{ symbol: searchRegex }, { name: searchRegex }, { sector: searchRegex }];
  }

  return Stock.find(findQuery).sort({ symbol: 1 }).limit(limit);
};

const fetchYahooQuoteMap = async (symbols) => {
  const symbolChunks = chunkArray(symbols, 50);
  const quoteMap = new Map();

  for (const symbolChunk of symbolChunks) {
    const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(
      symbolChunk.join(',')
    )}`;
    const payload = await getJson(url, {
      headers: YAHOO_REQUEST_HEADERS,
    });
    const results = payload?.quoteResponse?.result;

    if (!Array.isArray(results)) {
      continue;
    }

    for (const quote of results) {
      if (quote?.symbol) {
        quoteMap.set(quote.symbol.toUpperCase(), quote);
      }
    }
  }

  return quoteMap;
};

const normalizeFinnhubQuote = (symbol, payload) => {
  const currentPrice = toNumber(payload?.c);
  const previousClose = toNumber(payload?.pc);
  const change = toNumber(payload?.d);
  const changePercent = toNumber(payload?.dp);
  const marketTime = toNumber(payload?.t);

  if (currentPrice === null && previousClose === null) {
    return null;
  }

  return {
    symbol,
    regularMarketPrice: currentPrice,
    regularMarketPreviousClose: previousClose,
    regularMarketChange: change,
    regularMarketChangePercent: changePercent,
    regularMarketTime: marketTime,
    currency: 'USD',
  };
};

const fetchFinnhubQuoteMap = async (symbols) => {
  const apiKey = process.env.FINNHUB_API_KEY?.trim();
  if (!apiKey) {
    throw new Error('FINNHUB_API_KEY is not configured');
  }

  const quoteMap = new Map();
  const symbolChunks = chunkArray(symbols, FINNHUB_BATCH_SIZE);

  for (const symbolChunk of symbolChunks) {
    const responses = await Promise.all(
      symbolChunk.map(async (symbol) => {
        try {
          const url = `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(
            symbol
          )}&token=${encodeURIComponent(apiKey)}`;
          const payload = await getJson(url, {
            headers: {
              Accept: 'application/json',
            },
          });
          return {
            symbol,
            quote: normalizeFinnhubQuote(symbol, payload),
          };
        } catch (_error) {
          return {
            symbol,
            quote: null,
          };
        }
      })
    );

    responses.forEach(({ symbol, quote }) => {
      if (quote) {
        quoteMap.set(symbol, quote);
      }
    });
  }

  if (quoteMap.size === 0) {
    throw new Error('No valid finnhub quote results returned');
  }

  return quoteMap;
};

const fetchQuoteMapFromProviders = async (symbols) => {
  const providerPreference = (process.env.STOCK_QUOTE_PROVIDER || 'auto').trim().toLowerCase();
  const providerOrder =
    providerPreference === 'finnhub'
      ? ['finnhub', 'yahoo-finance']
      : providerPreference === 'yahoo'
      ? ['yahoo-finance', 'finnhub']
      : process.env.FINNHUB_API_KEY
      ? ['finnhub', 'yahoo-finance']
      : ['yahoo-finance', 'finnhub'];

  for (const provider of providerOrder) {
    try {
      if (provider === 'finnhub') {
        const quoteMap = await fetchFinnhubQuoteMap(symbols);
        return { source: 'finnhub', quoteMap };
      }

      if (provider === 'yahoo-finance') {
        const quoteMap = await fetchYahooQuoteMap(symbols);
        return { source: 'yahoo-finance', quoteMap };
      }
    } catch (_error) {
      // Try next provider.
    }
  }

  throw new Error('All live quote providers failed');
};

const buildLiveQuotes = (stocks, quoteMap, generatedAt) =>
  stocks.map((stock) => {
    const quote = quoteMap.get(stock.symbol);
    const regularMarketPrice = toNumber(quote?.regularMarketPrice);
    const regularMarketPreviousClose = toNumber(quote?.regularMarketPreviousClose);
    const regularMarketChange = toNumber(quote?.regularMarketChange);
    const regularMarketChangePercent = toNumber(quote?.regularMarketChangePercent);

    const price = regularMarketPrice ?? Number(stock.lastPrice) ?? 0;
    const previousClose = regularMarketPreviousClose ?? Number(stock.previousClose) ?? price;
    const change = regularMarketChange ?? Number((price - previousClose).toFixed(2));
    const changePercent =
      regularMarketChangePercent ??
      Number((previousClose ? (change / previousClose) * 100 : 0).toFixed(2));

    return {
      stockId: stock._id,
      symbol: stock.symbol,
      name: stock.name,
      exchange: stock.exchange,
      currency: quote?.currency || stock.currency || 'USD',
      sector: stock.sector,
      price: Number(price.toFixed(2)),
      previousClose: Number(previousClose.toFixed(2)),
      change: Number(change.toFixed(2)),
      changePercent: Number(changePercent.toFixed(2)),
      updatedAt: quote?.regularMarketTime
        ? new Date(quote.regularMarketTime * 1000).toISOString()
        : generatedAt,
    };
  });

const buildFallbackQuotes = (stocks, generatedAt) =>
  stocks.map((stock) => {
    const state = fallbackQuoteState.get(stock.symbol) || {
      price: Number(stock.lastPrice) || Number(stock.previousClose) || 100,
      previousClose: Number(stock.previousClose) || Number(stock.lastPrice) || 100,
    };

    const deltaPercent = (Math.random() * 0.9 - 0.45) / 100;
    const nextPrice = Math.max(0.01, state.price * (1 + deltaPercent));

    state.price = Number(nextPrice.toFixed(2));
    fallbackQuoteState.set(stock.symbol, state);

    const change = Number((state.price - state.previousClose).toFixed(2));
    const changePercent = Number(
      (state.previousClose ? (change / state.previousClose) * 100 : 0).toFixed(2)
    );

    return {
      stockId: stock._id,
      symbol: stock.symbol,
      name: stock.name,
      exchange: stock.exchange,
      currency: stock.currency || 'USD',
      sector: stock.sector,
      price: state.price,
      previousClose: state.previousClose,
      change,
      changePercent,
      updatedAt: generatedAt,
    };
  });

const syncQuotePricesToStocks = async (quotes) => {
  if (!Array.isArray(quotes) || quotes.length === 0) {
    return;
  }

  const operations = quotes.map((quote) => ({
    updateOne: {
      filter: { _id: quote.stockId },
      update: {
        $set: {
          lastPrice: quote.price,
          previousClose: quote.previousClose,
        },
      },
    },
  }));

  await Stock.bulkWrite(operations, { ordered: false });
};

const buildStockQuotePayload = async (query = {}) => {
  const stocks = await resolveStocksForQuotes(query);
  if (stocks.length === 0) {
    return {
      source: 'database',
      generatedAt: new Date().toISOString(),
      count: 0,
      quotes: [],
    };
  }

  const symbols = stocks.map((stock) => stock.symbol);
  const generatedAt = new Date().toISOString();

  try {
    const liveQuotes = await fetchQuoteMapFromProviders(symbols);
    const quoteMap = liveQuotes.quoteMap;
    const quotes = buildLiveQuotes(stocks, quoteMap, generatedAt);
    await syncQuotePricesToStocks(quotes);

    return {
      source: liveQuotes.source,
      generatedAt,
      count: quotes.length,
      quotes: quotes.map((quote) => ({
        ...quote,
        stockId: String(quote.stockId),
      })),
    };
  } catch (_error) {
    const quotes = buildFallbackQuotes(stocks, generatedAt);
    await syncQuotePricesToStocks(quotes);

    return {
      source: 'simulated-fallback',
      generatedAt,
      warning: 'Live stock quotes unavailable; returning simulated data',
      count: quotes.length,
      quotes: quotes.map((quote) => ({
        ...quote,
        stockId: String(quote.stockId),
      })),
    };
  }
};

const listStocks = async (req, res, next) => {
  try {
    const { page, limit, skip } = parsePagination(req.query, 25, 100);
    const query = {};

    if (req.query.active !== undefined) {
      query.isActive = parseBoolean(req.query.active, 'active');
    }

    if (req.query.exchange) {
      query.exchange = req.query.exchange.toUpperCase();
    }

    if (req.query.symbol) {
      query.symbol = req.query.symbol.toUpperCase();
    }

    if (req.query.search) {
      const term = req.query.search.trim();
      const searchRegex = new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      query.$or = [{ symbol: searchRegex }, { name: searchRegex }, { sector: searchRegex }];
    }

    const [stocks, total] = await Promise.all([
      Stock.find(query)
        .sort({ symbol: 1 })
        .skip(skip)
        .limit(limit),
      Stock.countDocuments(query),
    ]);

    res.status(200).json({
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
      items: stocks.map(buildStockResponse),
    });
  } catch (error) {
    next(error);
  }
};

const getStockQuotes = async (req, res, next) => {
  try {
    const payload = await buildStockQuotePayload(req.query);
    res.status(200).json(payload);
  } catch (error) {
    next(error);
  }
};

const streamStockQuotes = async (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');

  if (typeof res.flushHeaders === 'function') {
    res.flushHeaders();
  }

  const intervalMs =
    parseNumber(req.query.intervalMs, 'intervalMs', {
      required: false,
      min: MIN_STREAM_INTERVAL_MS,
      max: MAX_STREAM_INTERVAL_MS,
      integer: true,
    }) || DEFAULT_STREAM_INTERVAL_MS;

  let isClosed = false;

  const sendUpdate = async () => {
    const payload = await buildStockQuotePayload(req.query);
    if (!isClosed) {
      res.write(`data: ${JSON.stringify(payload)}\n\n`);
    }
  };

  try {
    await sendUpdate();
  } catch (_error) {
    if (!isClosed) {
      res.write(
        `event: error\ndata: ${JSON.stringify({
          message: 'Unable to send initial stock quote update',
          timestamp: new Date().toISOString(),
        })}\n\n`
      );
    }
  }

  const updateTimer = setInterval(() => {
    sendUpdate().catch((_error) => {
      if (!isClosed) {
        res.write(
          `event: error\ndata: ${JSON.stringify({
            message: 'Unable to refresh stock quotes',
            timestamp: new Date().toISOString(),
          })}\n\n`
        );
      }
    });
  }, intervalMs);

  const keepAliveTimer = setInterval(() => {
    if (!isClosed) {
      res.write(': keepalive\n\n');
    }
  }, 25000);

  req.on('close', () => {
    isClosed = true;
    clearInterval(updateTimer);
    clearInterval(keepAliveTimer);
    res.end();
  });
};

const getStockById = async (req, res, next) => {
  try {
    const stockId = ensureObjectId(req.params.id, 'Stock id');
    const stock = await Stock.findById(stockId);

    if (!stock) {
      throw createHttpError(404, 'Stock not found');
    }

    res.status(200).json({ stock: buildStockResponse(stock) });
  } catch (error) {
    next(error);
  }
};

const createStock = async (req, res, next) => {
  try {
    const payload = {
      symbol: requireString(req.body.symbol, 'Symbol', 15).toUpperCase(),
      name: requireString(req.body.name, 'Name', 120),
      exchange: optionalString(req.body.exchange, 'Exchange', 20) || 'NASDAQ',
      currency: (optionalString(req.body.currency, 'Currency', 5) || 'USD').toUpperCase(),
      sector: optionalString(req.body.sector, 'Sector', 80) || 'Unknown',
      lastPrice: parseNumber(req.body.lastPrice, 'Last price', {
        required: false,
        min: 0,
      }),
      previousClose: parseNumber(req.body.previousClose, 'Previous close', {
        required: false,
        min: 0,
      }),
      isActive: parseBoolean(req.body.isActive, 'isActive', false),
    };

    if (payload.lastPrice === undefined) {
      payload.lastPrice = 0;
    }

    if (payload.previousClose === undefined) {
      payload.previousClose = payload.lastPrice;
    }

    if (payload.isActive === undefined) {
      payload.isActive = true;
    }

    const stock = await Stock.create(payload);
    res.status(201).json({ stock: buildStockResponse(stock) });
  } catch (error) {
    if (error.code === 11000) {
      res.status(409);
      return next(new Error('A stock with this symbol already exists'));
    }
    return next(error);
  }
};

const updateStock = async (req, res, next) => {
  try {
    const stockId = ensureObjectId(req.params.id, 'Stock id');
    const stock = await Stock.findById(stockId);

    if (!stock) {
      throw createHttpError(404, 'Stock not found');
    }

    if (req.body.symbol !== undefined) {
      stock.symbol = requireString(req.body.symbol, 'Symbol', 15).toUpperCase();
    }
    if (req.body.name !== undefined) {
      stock.name = requireString(req.body.name, 'Name', 120);
    }
    if (req.body.exchange !== undefined) {
      stock.exchange = requireString(req.body.exchange, 'Exchange', 20).toUpperCase();
    }
    if (req.body.currency !== undefined) {
      stock.currency = requireString(req.body.currency, 'Currency', 5).toUpperCase();
    }
    if (req.body.sector !== undefined) {
      stock.sector = requireString(req.body.sector, 'Sector', 80);
    }
    if (req.body.lastPrice !== undefined) {
      stock.lastPrice = parseNumber(req.body.lastPrice, 'Last price', { min: 0 });
    }
    if (req.body.previousClose !== undefined) {
      stock.previousClose = parseNumber(req.body.previousClose, 'Previous close', { min: 0 });
    }
    if (req.body.isActive !== undefined) {
      stock.isActive = parseBoolean(req.body.isActive, 'isActive', true);
    }

    await stock.save();

    res.status(200).json({ stock: buildStockResponse(stock) });
  } catch (error) {
    if (error.code === 11000) {
      res.status(409);
      return next(new Error('A stock with this symbol already exists'));
    }
    return next(error);
  }
};

const deleteStock = async (req, res, next) => {
  try {
    const stockId = ensureObjectId(req.params.id, 'Stock id');
    const stock = await Stock.findById(stockId);

    if (!stock) {
      throw createHttpError(404, 'Stock not found');
    }

    const usageCount = await Transaction.countDocuments({ stock: stockId });
    if (usageCount > 0) {
      throw createHttpError(409, 'Cannot delete stock with existing transactions');
    }

    await stock.deleteOne();
    res.status(200).json({ message: 'Stock deleted successfully' });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  listStocks,
  getStockById,
  createStock,
  updateStock,
  deleteStock,
  getStockQuotes,
  streamStockQuotes,
};
