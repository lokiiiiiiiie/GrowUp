import React, { useEffect, useMemo, useState } from 'react';
import { toast } from 'react-toastify';
import api from '../api/client';

const Trade = () => {
  const [symbol, setSymbol] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [orderType, setOrderType] = useState('buy');
  const [executionType, setExecutionType] = useState('market');
  const [limitPrice, setLimitPrice] = useState('');
  const [fees, setFees] = useState('0');
  const [stopLoss, setStopLoss] = useState('');
  const [stocks, setStocks] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const fetchStocks = async () => {
      try {
        const response = await api.get('/api/stocks', {
          params: { active: true, limit: 100 },
        });
        setStocks(response.data.items || []);
      } catch (error) {
        toast.error(error.response?.data?.message || 'Unable to load tradable stocks');
      }
    };

    fetchStocks();
  }, []);

  const stockMap = useMemo(() => {
    const map = new Map();
    stocks.forEach((stock) => map.set(stock.symbol, stock));
    return map;
  }, [stocks]);

  const displaySymbol = symbol.trim().toUpperCase();
  const selectedStock = stockMap.get(displaySymbol);
  const spotPrice = selectedStock?.lastPrice || 0;
  const parsedQuantity = Number(quantity) || 0;
  const entryPrice = executionType === 'limit' && limitPrice ? Number(limitPrice) : Number(spotPrice || 0);
  const parsedFees = Number(fees) || 0;
  const estimatedValue = parsedQuantity * entryPrice + parsedFees;
  const parsedStopLoss = Number(stopLoss);
  const riskPerShare = parsedStopLoss > 0 && parsedStopLoss < entryPrice ? entryPrice - parsedStopLoss : 0;
  const estimatedRisk = riskPerShare * parsedQuantity;

  const quickSymbols = stocks.slice(0, 6).map((stock) => ({
    code: stock.symbol,
    qty: 1,
  }));

  const preTradeChecklist = [
    'Confirm order side and quantity before submission.',
    'Check if limit price is realistic versus last traded price.',
    'Verify fees and expected risk fit your daily plan.',
  ];

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!displaySymbol) {
      toast.error('Stock symbol is required');
      return;
    }

    if (!selectedStock) {
      toast.error('Unknown symbol. Select a listed stock.');
      return;
    }

    if (executionType === 'limit' && (!limitPrice || Number(limitPrice) <= 0)) {
      toast.error('Limit price must be greater than 0');
      return;
    }

    try {
      setIsSubmitting(true);
      const payload = {
        symbol: displaySymbol,
        side: orderType,
        quantity: parsedQuantity,
        price: executionType === 'limit' ? Number(limitPrice) : Number(spotPrice || 0),
        fees: parsedFees,
        status: 'filled',
      };

      await api.post('/api/transactions', payload);
      toast.success(`Order placed: ${orderType.toUpperCase()} ${parsedQuantity} ${displaySymbol}`);
      setLimitPrice('');
      setStopLoss('');
      setFees('0');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Unable to place order');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="page trade-page">
      <section className="page-heading">
        <p className="eyebrow">GrowUp Execution Desk</p>
        <h1>Virtual Buy/Sell Transactions</h1>
        <p className="muted">
          Place simulated trades backed by portfolio checks, holdings validation, and transaction history.
        </p>
      </section>

      <section className="trade-grid">
        <article className="panel">
          <div className="quick-symbols">
            {quickSymbols.map((item) => (
              <button
                key={item.code}
                type="button"
                className="btn ghost"
                onClick={() => {
                  setSymbol(item.code);
                  setQuantity(item.qty);
                }}
              >
                {item.code} x{item.qty}
              </button>
            ))}
          </div>
          <form onSubmit={handleSubmit} className="form">
            <label>
              <span>Symbol</span>
              <input
                type="text"
                value={symbol}
                onChange={(event) => setSymbol(event.target.value.toUpperCase())}
                placeholder="AAPL"
                required
              />
            </label>

            <label>
              <span>Quantity</span>
              <input
                type="number"
                min="0.000001"
                step="0.000001"
                value={quantity}
                onChange={(event) => setQuantity(event.target.value)}
                required
              />
            </label>

            <label>
              <span>Order Side</span>
              <select value={orderType} onChange={(event) => setOrderType(event.target.value)}>
                <option value="buy">Buy</option>
                <option value="sell">Sell</option>
              </select>
            </label>

            <label>
              <span>Execution Type</span>
              <select value={executionType} onChange={(event) => setExecutionType(event.target.value)}>
                <option value="market">Market</option>
                <option value="limit">Limit</option>
              </select>
            </label>

            {executionType === 'limit' ? (
              <label>
                <span>Limit Price</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={limitPrice}
                  onChange={(event) => setLimitPrice(event.target.value)}
                  placeholder="Enter limit price"
                />
              </label>
            ) : null}

            <label>
              <span>Estimated Fees</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={fees}
                onChange={(event) => setFees(event.target.value)}
              />
            </label>

            <label>
              <span>Stop Loss (optional)</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={stopLoss}
                onChange={(event) => setStopLoss(event.target.value)}
                placeholder="Example: 184.50"
              />
            </label>

            <button type="submit" className="btn primary wide" disabled={isSubmitting}>
              {isSubmitting ? 'Submitting...' : 'Submit Order'}
            </button>
          </form>
        </article>

        <article className="panel trade-summary">
          <p className="eyebrow">Order Summary</p>
          <h2>Preview</h2>
          <div className="summary-row">
            <span>Ticker</span>
            <strong>{displaySymbol || 'N/A'}</strong>
          </div>
          <div className="summary-row">
            <span>Spot Price</span>
            <strong>${Number(spotPrice || 0).toFixed(2)}</strong>
          </div>
          <div className="summary-row">
            <span>Entry Price</span>
            <strong>${Number(entryPrice || 0).toFixed(2)}</strong>
          </div>
          <div className="summary-row">
            <span>Order Side</span>
            <strong className={orderType === 'buy' ? 'text-up' : 'text-down'}>{orderType.toUpperCase()}</strong>
          </div>
          <div className="summary-row">
            <span>Estimated Value</span>
            <strong>${estimatedValue.toLocaleString(undefined, { maximumFractionDigits: 2 })}</strong>
          </div>
          <div className="summary-row">
            <span>Execution</span>
            <strong>{executionType === 'market' ? 'Market Order' : 'Limit Order'}</strong>
          </div>
          <div className="summary-row">
            <span>Estimated Risk</span>
            <strong>${estimatedRisk.toLocaleString(undefined, { maximumFractionDigits: 2 })}</strong>
          </div>
          <p className="tip">Orders are validated against available cash and current holdings before execution.</p>
        </article>
      </section>

      <section className="panel">
        <p className="eyebrow">Trade Quality Filter</p>
        <h2>Pre-trade checklist</h2>
        <div className="checklist-list">
          {preTradeChecklist.map((item) => (
            <div key={item} className="checklist-item">
              <span className="check-dot" />
              <p>{item}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};

export default Trade;
