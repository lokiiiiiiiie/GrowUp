import React, { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'react-toastify';
import api from '../api/client';

const Stocks = () => {
  const [query, setQuery] = useState('');
  const [stocks, setStocks] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [quotesBySymbol, setQuotesBySymbol] = useState({});
  const [quoteMeta, setQuoteMeta] = useState({
    source: '',
    updatedAt: '',
    warning: '',
    error: '',
  });
  const activeSearchRef = useRef('');

  const fetchLiveQuotes = useCallback(async (searchTerm = '', options = {}) => {
    const { silent = false } = options;

    try {
      const response = await api.get('/api/stocks/quotes', {
        params: {
          search: searchTerm || undefined,
          limit: 100,
        },
      });

      const quotes = Array.isArray(response.data?.quotes) ? response.data.quotes : [];
      const map = {};
      quotes.forEach((quote) => {
        if (quote?.symbol) {
          map[quote.symbol] = quote;
        }
      });

      setQuotesBySymbol(map);
      setQuoteMeta({
        source: response.data?.source || 'unknown',
        updatedAt: response.data?.generatedAt || '',
        warning: response.data?.warning || '',
        error: '',
      });
    } catch (error) {
      const message = error.response?.data?.message || 'Unable to load live stock quotes';
      setQuoteMeta((previous) => ({ ...previous, error: message }));
      if (!silent) {
        toast.error(message);
      }
    }
  }, []);

  const fetchStocks = useCallback(
    async (searchTerm = '') => {
      try {
        setIsLoading(true);
        activeSearchRef.current = searchTerm;

        const response = await api.get('/api/stocks', {
          params: { search: searchTerm || undefined, limit: 100 },
        });
        const items = response.data.items || [];
        setStocks(items);

        await fetchLiveQuotes(searchTerm, { silent: true });
      } catch (error) {
        toast.error(error.response?.data?.message || 'Unable to load stocks');
      } finally {
        setIsLoading(false);
      }
    },
    [fetchLiveQuotes]
  );

  useEffect(() => {
    fetchStocks();
  }, [fetchStocks]);

  useEffect(() => {
    const timer = setInterval(() => {
      fetchLiveQuotes(activeSearchRef.current, { silent: true });
    }, 3000);

    return () => clearInterval(timer);
  }, [fetchLiveQuotes]);

  const handleSearch = (event) => {
    event.preventDefault();
    fetchStocks(query.trim());
  };

  return (
    <div className="page">
      <section className="page-heading">
        <p className="eyebrow">Market Explorer</p>
        <h1>Stock Listing and Search</h1>
        <p className="muted">Search tradable stocks, inspect prices, and review market metadata.</p>
      </section>

      <section className="panel">
        <form className="form" onSubmit={handleSearch}>
          <label>
            <span>Search by symbol, name, or sector</span>
            <input
              type="text"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="AAPL, Tesla, Technology..."
            />
          </label>
          <button type="submit" className="btn primary">
            Search
          </button>
        </form>
      </section>

      <section className="panel">
        <p className="eyebrow">Results</p>
        <h2>{isLoading ? 'Loading...' : `${stocks.length} stocks found`}</h2>
        <p className="market-meta muted">
          Source: {quoteMeta.source || 'n/a'} | Updated:{' '}
          {quoteMeta.updatedAt ? new Date(quoteMeta.updatedAt).toLocaleTimeString() : '--'}
        </p>
        {quoteMeta.warning ? <p className="market-meta muted">{quoteMeta.warning}</p> : null}
        {quoteMeta.error ? <p className="market-meta text-down">{quoteMeta.error}</p> : null}
        <div className="table-wrap">
          <table className="portfolio-table">
            <thead>
              <tr>
                <th>Symbol</th>
                <th>Name</th>
                <th>Exchange</th>
                <th>Sector</th>
                <th>Current Price</th>
                <th>Change</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {stocks.map((stock) => {
                const liveQuote = quotesBySymbol[stock.symbol];
                const currentPrice =
                  liveQuote && typeof liveQuote.price === 'number' ? liveQuote.price : Number(stock.lastPrice || 0);
                const change = liveQuote && typeof liveQuote.change === 'number' ? liveQuote.change : null;
                const changePercent =
                  liveQuote && typeof liveQuote.changePercent === 'number' ? liveQuote.changePercent : null;
                const formattedChange =
                  change !== null && changePercent !== null
                    ? `${change >= 0 ? '+' : ''}${change.toFixed(2)} (${changePercent >= 0 ? '+' : ''}${changePercent.toFixed(2)}%)`
                    : '--';

                return (
                  <tr key={stock.id}>
                    <td>{stock.symbol}</td>
                    <td>{stock.name}</td>
                    <td>{stock.exchange}</td>
                    <td>{stock.sector}</td>
                    <td>${Number(currentPrice || 0).toFixed(2)}</td>
                    <td className={change === null ? 'muted' : change >= 0 ? 'text-up' : 'text-down'}>
                      {formattedChange}
                    </td>
                    <td className={stock.isActive ? 'text-up' : 'text-down'}>
                      {stock.isActive ? 'Active' : 'Inactive'}
                    </td>
                  </tr>
                );
              })}
              {!isLoading && stocks.length === 0 ? (
                <tr>
                  <td colSpan="7" className="muted">
                    No stocks matched your search.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};

export default Stocks;
