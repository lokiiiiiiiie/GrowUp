import React, { useEffect, useMemo, useState } from 'react';
import { toast } from 'react-toastify';
import api from '../api/client';

const Portfolio = () => {
  const [portfolio, setPortfolio] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  const loadPortfolio = async () => {
    try {
      setIsLoading(true);
      const response = await api.get('/api/portfolios/me');
      setPortfolio(response.data.portfolio);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Unable to load portfolio');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadPortfolio();
  }, []);

  const holdings = useMemo(() => portfolio?.holdings || [], [portfolio]);
  const totalValue = Number(portfolio?.totalMarketValue || 0);
  const totalCost = Number(portfolio?.totalInvested || 0);
  const cashBalance = Number(portfolio?.cashBalance || 0);
  const realizedPnL = Number(portfolio?.realizedPnL || 0);
  const unrealizedPnL = totalValue - cashBalance - totalCost;

  const topPosition = holdings.reduce((largest, item) => {
    const marketValue = Number(item.marketValue || 0);
    if (!largest || marketValue > largest.marketValue) {
      return {
        symbol: item.stock?.symbol || '--',
        marketValue,
      };
    }
    return largest;
  }, null);

  return (
    <div className="page portfolio-page">
      <section className="page-heading">
        <p className="eyebrow">GrowUp Account Summary</p>
        <h1>Portfolio and Holdings</h1>
        <p className="muted">
          Current balances, position-level exposure, and performance generated from your transaction ledger.
        </p>
      </section>

      <section className="metric-grid">
        <article className="panel metric-card">
          <span className="metric-label">Total Market Value</span>
          <strong className="metric-value">${totalValue.toLocaleString(undefined, { maximumFractionDigits: 2 })}</strong>
          <span className="metric-trend">Updated from current holdings + cash</span>
        </article>
        <article className="panel metric-card">
          <span className="metric-label">Cash Balance</span>
          <strong className="metric-value">${cashBalance.toLocaleString(undefined, { maximumFractionDigits: 2 })}</strong>
          <span className="metric-trend">Available buying power</span>
        </article>
        <article className="panel metric-card">
          <span className="metric-label">Realized P/L</span>
          <strong className={`metric-value ${realizedPnL >= 0 ? 'text-up' : 'text-down'}`}>
            {realizedPnL >= 0 ? '+' : '-'}${Math.abs(realizedPnL).toLocaleString(undefined, { maximumFractionDigits: 2 })}
          </strong>
          <span className="metric-trend">Closed trades only</span>
        </article>
        <article className="panel metric-card">
          <span className="metric-label">Largest Position</span>
          <strong className="metric-value">{topPosition ? topPosition.symbol : '--'}</strong>
          <span className="metric-trend">
            ${topPosition ? topPosition.marketValue.toLocaleString(undefined, { maximumFractionDigits: 2 }) : '--'}
          </span>
        </article>
      </section>

      <section className="panel">
        <p className="eyebrow">Holdings</p>
        <h2>{isLoading ? 'Loading...' : 'Position breakdown'}</h2>
        <div className="table-wrap">
          <table className="portfolio-table">
            <thead>
              <tr>
                <th>Symbol</th>
                <th>Shares</th>
                <th>Avg Price</th>
                <th>Current</th>
                <th>Market Value</th>
                <th>P/L</th>
              </tr>
            </thead>
            <tbody>
              {holdings.map((item) => {
                const quantity = Number(item.quantity || 0);
                const avgPrice = Number(item.averagePrice || 0);
                const currentPrice = Number(item.marketPrice || 0);
                const marketValue = Number(item.marketValue || 0);
                const costValue = quantity * avgPrice;
                const pnl = marketValue - costValue;

                return (
                  <tr key={item.stock?._id || item.stock}>
                    <td>{item.stock?.symbol || '--'}</td>
                    <td>{quantity.toLocaleString(undefined, { maximumFractionDigits: 6 })}</td>
                    <td>${avgPrice.toFixed(2)}</td>
                    <td>${currentPrice.toFixed(2)}</td>
                    <td>${marketValue.toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
                    <td className={pnl >= 0 ? 'text-up' : 'text-down'}>
                      {pnl >= 0 ? '+' : '-'}${Math.abs(pnl).toFixed(2)}
                    </td>
                  </tr>
                );
              })}
              {!isLoading && holdings.length === 0 ? (
                <tr>
                  <td colSpan="6" className="muted">
                    No holdings yet. Place a buy trade to open your first position.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className="portfolio-insight-grid">
        <article className="panel">
          <p className="eyebrow">Performance Snapshot</p>
          <h2>Unrealized and invested amounts</h2>
          <div className="insight-list">
            <div className="insight-row">
              <div>
                <strong>Total Invested</strong>
                <p>Capital currently deployed in open positions</p>
              </div>
              <span>${totalCost.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
            </div>
            <div className="insight-row">
              <div>
                <strong>Unrealized P/L</strong>
                <p>Difference between current market value and open cost basis</p>
              </div>
              <span className={unrealizedPnL >= 0 ? 'text-up' : 'text-down'}>
                {unrealizedPnL >= 0 ? '+' : '-'}${Math.abs(unrealizedPnL).toLocaleString(undefined, { maximumFractionDigits: 2 })}
              </span>
            </div>
            <div className="insight-row">
              <div>
                <strong>Base Cash Balance</strong>
                <p>Starting account balance used for virtual trading</p>
              </div>
              <span>${Number(portfolio?.baseCashBalance || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
            </div>
          </div>
        </article>
      </section>
    </div>
  );
};

export default Portfolio;
