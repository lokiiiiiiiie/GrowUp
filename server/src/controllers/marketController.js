const https = require('https');

const INDEX_DEFINITIONS = [
  { symbol: '^GSPC', code: 'SPX', name: 'S&P 500' },
  { symbol: '^NDX', code: 'NDX', name: 'Nasdaq 100' },
  { symbol: '^DJI', code: 'DJI', name: 'Dow Jones' },
  { symbol: '^RUT', code: 'RUT', name: 'Russell 2000' },
];

const fallbackState = {
  '^GSPC': { price: 5225.31, previousClose: 5204.51 },
  '^NDX': { price: 18319.45, previousClose: 18265.6 },
  '^DJI': { price: 38644.17, previousClose: 38552.99 },
  '^RUT': { price: 2075.92, previousClose: 2069.43 },
};

const getJson = (url) =>
  new Promise((resolve, reject) => {
    https
      .get(url, (res) => {
        const { statusCode } = res;
        let body = '';

        res.on('data', (chunk) => {
          body += chunk;
        });

        res.on('end', () => {
          if (statusCode < 200 || statusCode >= 300) {
            reject(new Error(`Market API returned HTTP ${statusCode}`));
            return;
          }

          try {
            resolve(JSON.parse(body));
          } catch (error) {
            reject(new Error('Market API returned invalid JSON'));
          }
        });
      })
      .on('error', (error) => reject(error));
  });

const toNumber = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

const normalizeQuote = (definition, quote) => {
  const price = toNumber(quote.regularMarketPrice);
  const change = toNumber(quote.regularMarketChange);
  const changePercent = toNumber(quote.regularMarketChangePercent);

  if (price === null || change === null || changePercent === null) {
    return null;
  }

  return {
    symbol: definition.symbol,
    code: definition.code,
    name: definition.name,
    price,
    change,
    changePercent,
    currency: quote.currency || 'USD',
    updatedAt: quote.regularMarketTime
      ? new Date(quote.regularMarketTime * 1000).toISOString()
      : new Date().toISOString(),
  };
};

const fetchYahooIndexes = async () => {
  const symbols = INDEX_DEFINITIONS.map((item) => item.symbol).join(',');
  const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(
    symbols
  )}`;
  const payload = await getJson(url);
  const results = payload?.quoteResponse?.result;

  if (!Array.isArray(results) || results.length === 0) {
    throw new Error('No market quote results returned');
  }

  const resultMap = new Map(results.map((item) => [item.symbol, item]));

  const indexes = INDEX_DEFINITIONS.map((definition) => {
    const quote = resultMap.get(definition.symbol);
    return quote ? normalizeQuote(definition, quote) : null;
  }).filter(Boolean);

  if (indexes.length === 0) {
    throw new Error('No valid index quotes available');
  }

  return indexes;
};

const buildFallbackIndexes = (generatedAt) =>
  INDEX_DEFINITIONS.map((definition) => {
    const state = fallbackState[definition.symbol];
    const deltaPercent = (Math.random() * 0.9 - 0.45) / 100;
    const nextPrice = Math.max(1, state.price * (1 + deltaPercent));

    state.price = Number(nextPrice.toFixed(2));
    const change = Number((state.price - state.previousClose).toFixed(2));
    const changePercent = Number(((change / state.previousClose) * 100).toFixed(2));

    return {
      symbol: definition.symbol,
      code: definition.code,
      name: definition.name,
      price: state.price,
      change,
      changePercent,
      currency: 'USD',
      updatedAt: generatedAt,
    };
  });

const getMarketPayload = async () => {
  try {
    const indexes = await fetchYahooIndexes();

    return {
      source: 'yahoo-finance',
      generatedAt: new Date().toISOString(),
      indexes,
    };
  } catch (_error) {
    const generatedAt = new Date().toISOString();
    const indexes = buildFallbackIndexes(generatedAt);

    return {
      source: 'simulated-fallback',
      generatedAt,
      warning: 'Live market feed unavailable; returning simulated data',
      indexes,
    };
  }
};

const getMarketIndexes = async (_req, res, next) => {
  try {
    const payload = await getMarketPayload();
    res.status(200).json(payload);
  } catch (error) {
    next(error);
  }
};

const streamMarketIndexes = async (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');

  if (typeof res.flushHeaders === 'function') {
    res.flushHeaders();
  }

  let isClosed = false;

  const sendUpdate = async () => {
    const payload = await getMarketPayload();

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
          message: 'Unable to send initial market update',
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
            message: 'Unable to refresh market data',
            timestamp: new Date().toISOString(),
          })}\n\n`
        );
      }
    });
  }, 5000);

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

module.exports = {
  getMarketIndexes,
  streamMarketIndexes,
};
