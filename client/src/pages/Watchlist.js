import React, { useEffect, useMemo, useState } from 'react';
import { toast } from 'react-toastify';
import api from '../api/client';

const Watchlist = () => {
  const [watchlist, setWatchlist] = useState(null);
  const [stocks, setStocks] = useState([]);
  const [selectedStockId, setSelectedStockId] = useState('');
  const [note, setNote] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const loadData = async () => {
    try {
      setIsLoading(true);
      const [watchlistResponse, stockResponse] = await Promise.all([
        api.get('/api/watchlists/me'),
        api.get('/api/stocks', { params: { active: true, limit: 100 } }),
      ]);

      setWatchlist(watchlistResponse.data.watchlist);
      setStocks(stockResponse.data.items || []);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Unable to load watchlist');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const availableStocks = useMemo(() => {
    const activeIds = new Set((watchlist?.items || []).map((item) => String(item.stock?._id || item.stock)));
    return stocks.filter((stock) => !activeIds.has(String(stock.id)));
  }, [stocks, watchlist]);

  const addItem = async (event) => {
    event.preventDefault();
    if (!selectedStockId) {
      toast.error('Select a stock first');
      return;
    }

    try {
      const response = await api.post('/api/watchlists/me/items', { stockId: selectedStockId, note });
      setWatchlist(response.data.watchlist);
      setSelectedStockId('');
      setNote('');
      toast.success('Stock added to watchlist');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Unable to add stock');
    }
  };

  const removeItem = async (stockId) => {
    try {
      const response = await api.delete(`/api/watchlists/me/items/${stockId}`);
      setWatchlist(response.data.watchlist);
      toast.success('Stock removed');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Unable to remove stock');
    }
  };

  return (
    <div className="page">
      <section className="page-heading">
        <p className="eyebrow">Personal Radar</p>
        <h1>Watchlist Management</h1>
        <p className="muted">Build and maintain a focused list of stocks you want to monitor.</p>
      </section>

      <section className="panel">
        <p className="eyebrow">Add Stock</p>
        <h2>New watchlist entry</h2>
        <form className="form" onSubmit={addItem}>
          <label>
            <span>Stock</span>
            <select value={selectedStockId} onChange={(event) => setSelectedStockId(event.target.value)} required>
              <option value="">Select stock</option>
              {availableStocks.map((stock) => (
                <option key={stock.id} value={stock.id}>
                  {stock.symbol} - {stock.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Note (optional)</span>
            <input
              type="text"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Breakout setup, earnings watch, support level..."
            />
          </label>
          <button type="submit" className="btn primary">
            Add to Watchlist
          </button>
        </form>
      </section>

      <section className="panel">
        <p className="eyebrow">Current Watchlist</p>
        <h2>{isLoading ? 'Loading...' : `${watchlist?.items?.length || 0} stocks tracked`}</h2>
        <div className="table-wrap">
          <table className="portfolio-table">
            <thead>
              <tr>
                <th>Symbol</th>
                <th>Name</th>
                <th>Note</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {(watchlist?.items || []).map((item) => {
                const stock = item.stock || {};
                const stockId = String(stock._id || item.stock);

                return (
                  <tr key={stockId}>
                    <td>{stock.symbol || '--'}</td>
                    <td>{stock.name || '--'}</td>
                    <td>{item.note || '--'}</td>
                    <td>
                      <button type="button" className="btn ghost" onClick={() => removeItem(stockId)}>
                        Remove
                      </button>
                    </td>
                  </tr>
                );
              })}
              {!isLoading && (watchlist?.items || []).length === 0 ? (
                <tr>
                  <td colSpan="4" className="muted">
                    Your watchlist is empty.
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

export default Watchlist;
