import React, { useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import api from '../api/client';

const defaultForm = {
  symbol: '',
  name: '',
  exchange: 'NASDAQ',
  currency: 'USD',
  sector: 'Unknown',
  lastPrice: '',
  previousClose: '',
  isActive: true,
};

const AdminStocks = () => {
  const [stocks, setStocks] = useState([]);
  const [search, setSearch] = useState('');
  const [editingId, setEditingId] = useState('');
  const [form, setForm] = useState(defaultForm);
  const [isLoading, setIsLoading] = useState(false);

  const loadStocks = async (searchTerm = '') => {
    try {
      setIsLoading(true);
      const response = await api.get('/api/admin/stocks', {
        params: { search: searchTerm || undefined, limit: 100 },
      });
      setStocks(response.data.items || []);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Unable to fetch admin stocks');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadStocks();
  }, []);

  const resetForm = () => {
    setEditingId('');
    setForm(defaultForm);
  };

  const submitForm = async (event) => {
    event.preventDefault();

    const payload = {
      ...form,
      symbol: form.symbol.trim().toUpperCase(),
      name: form.name.trim(),
      exchange: form.exchange.trim().toUpperCase(),
      currency: form.currency.trim().toUpperCase(),
      sector: form.sector.trim(),
      lastPrice: Number(form.lastPrice || 0),
      previousClose: Number(form.previousClose || form.lastPrice || 0),
      isActive: Boolean(form.isActive),
    };

    try {
      if (editingId) {
        await api.put(`/api/admin/stocks/${editingId}`, payload);
        toast.success('Stock updated');
      } else {
        await api.post('/api/admin/stocks', payload);
        toast.success('Stock created');
      }

      resetForm();
      await loadStocks(search.trim());
    } catch (error) {
      toast.error(error.response?.data?.message || 'Unable to save stock');
    }
  };

  const startEdit = (stock) => {
    setEditingId(stock.id);
    setForm({
      symbol: stock.symbol,
      name: stock.name,
      exchange: stock.exchange,
      currency: stock.currency,
      sector: stock.sector,
      lastPrice: String(stock.lastPrice ?? ''),
      previousClose: String(stock.previousClose ?? ''),
      isActive: stock.isActive,
    });
  };

  const deleteStock = async (id) => {
    try {
      await api.delete(`/api/admin/stocks/${id}`);
      toast.success('Stock deleted');
      await loadStocks(search.trim());
    } catch (error) {
      toast.error(error.response?.data?.message || 'Unable to delete stock');
    }
  };

  const handleSearch = async (event) => {
    event.preventDefault();
    await loadStocks(search.trim());
  };

  return (
    <div className="page">
      <section className="page-heading">
        <p className="eyebrow">Admin Console</p>
        <h1>Stock Management Panel</h1>
        <p className="muted">Create, update, and remove tradable stocks with validation and search support.</p>
      </section>

      <section className="panel">
        <p className="eyebrow">{editingId ? 'Edit Stock' : 'Create Stock'}</p>
        <h2>{editingId ? 'Update stock details' : 'Add new stock'}</h2>
        <form className="form" onSubmit={submitForm}>
          <label>
            <span>Symbol</span>
            <input
              type="text"
              value={form.symbol}
              onChange={(event) => setForm((prev) => ({ ...prev, symbol: event.target.value }))}
              required
            />
          </label>
          <label>
            <span>Name</span>
            <input
              type="text"
              value={form.name}
              onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
              required
            />
          </label>
          <label>
            <span>Exchange</span>
            <input
              type="text"
              value={form.exchange}
              onChange={(event) => setForm((prev) => ({ ...prev, exchange: event.target.value }))}
              required
            />
          </label>
          <label>
            <span>Currency</span>
            <input
              type="text"
              value={form.currency}
              onChange={(event) => setForm((prev) => ({ ...prev, currency: event.target.value }))}
              required
            />
          </label>
          <label>
            <span>Sector</span>
            <input
              type="text"
              value={form.sector}
              onChange={(event) => setForm((prev) => ({ ...prev, sector: event.target.value }))}
              required
            />
          </label>
          <label>
            <span>Last Price</span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={form.lastPrice}
              onChange={(event) => setForm((prev) => ({ ...prev, lastPrice: event.target.value }))}
              required
            />
          </label>
          <label>
            <span>Previous Close</span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={form.previousClose}
              onChange={(event) => setForm((prev) => ({ ...prev, previousClose: event.target.value }))}
            />
          </label>
          <label>
            <span>Active</span>
            <select
              value={form.isActive ? 'true' : 'false'}
              onChange={(event) => setForm((prev) => ({ ...prev, isActive: event.target.value === 'true' }))}
            >
              <option value="true">Active</option>
              <option value="false">Inactive</option>
            </select>
          </label>
          <button type="submit" className="btn primary">
            {editingId ? 'Update Stock' : 'Create Stock'}
          </button>
          {editingId ? (
            <button type="button" className="btn ghost" onClick={resetForm}>
              Cancel Edit
            </button>
          ) : null}
        </form>
      </section>

      <section className="panel">
        <form className="form" onSubmit={handleSearch}>
          <label>
            <span>Search stocks</span>
            <input
              type="text"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by symbol, name, sector..."
            />
          </label>
          <button type="submit" className="btn ghost">
            Search
          </button>
        </form>

        <div className="table-wrap">
          <table className="portfolio-table">
            <thead>
              <tr>
                <th>Symbol</th>
                <th>Name</th>
                <th>Price</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {stocks.map((stock) => (
                <tr key={stock.id}>
                  <td>{stock.symbol}</td>
                  <td>{stock.name}</td>
                  <td>${Number(stock.lastPrice || 0).toFixed(2)}</td>
                  <td className={stock.isActive ? 'text-up' : 'text-down'}>
                    {stock.isActive ? 'Active' : 'Inactive'}
                  </td>
                  <td>
                    <div className="quick-symbols">
                      <button type="button" className="btn ghost" onClick={() => startEdit(stock)}>
                        Edit
                      </button>
                      <button type="button" className="btn ghost" onClick={() => deleteStock(stock.id)}>
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {!isLoading && stocks.length === 0 ? (
                <tr>
                  <td colSpan="5" className="muted">
                    No stocks found.
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

export default AdminStocks;
