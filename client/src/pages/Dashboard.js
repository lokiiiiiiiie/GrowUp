import React from 'react';
import useMarketIndexes from '../hooks/useMarketIndexes';
import { formatCurrency, formatPercent, formatTime, getTrendClass } from '../utils/marketFormat';

const formatPoints = (value) => {
  if (typeof value !== 'number') {
    return '--';
  }

  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(2)} pts`;
};

const Dashboard = () => {
  const { indexes, marketStatus } = useMarketIndexes();

  const metrics = [
    { label: 'Portfolio Value', value: '$128,430', trend: '+3.4% this week' },
    { label: 'Buying Power', value: '$24,800', trend: 'Ready to deploy' },
    { label: 'Win Rate', value: '62.7%', trend: '+1.2% month over month' },
    { label: 'Open Positions', value: '8', trend: 'Across 4 sectors' },
  ];

  const activities = [
    { time: '09:42', action: 'Buy', symbol: 'NVDA', qty: 6, note: 'Momentum breakout' },
    { time: '10:08', action: 'Sell', symbol: 'AAPL', qty: 4, note: 'Scaled out at resistance' },
    { time: '11:15', action: 'Buy', symbol: 'MSFT', qty: 3, note: 'Re-entry on pullback' },
  ];

  const missions = [
    { title: 'Journal 3 completed trades', status: 'In Progress', eta: 'Today' },
    { title: 'Keep average risk under 1.2%', status: 'On Track', eta: 'This week' },
    { title: 'No revenge trades after losses', status: 'Maintained', eta: '5 sessions' },
  ];

  const watchlist = [
    { symbol: 'AMZN', setup: 'Range breakout', level: '$182.50 trigger', bias: 'Bullish' },
    { symbol: 'META', setup: 'Retest continuation', level: '$509 support', bias: 'Bullish' },
    { symbol: 'TSLA', setup: 'Failed bounce risk', level: '$208 resistance', bias: 'Cautious' },
  ];

  return (
    <div className="page dashboard-page">
      <section className="page-heading">
        <p className="eyebrow">GrowUp Control Center</p>
        <h1>Growth Dashboard</h1>
        <p className="muted">
          Track your performance, refine your habits, and react faster with structured insights.
        </p>
      </section>

      <section className="metric-grid">
        {metrics.map((metric) => (
          <article key={metric.label} className="panel metric-card">
            <span className="metric-label">{metric.label}</span>
            <strong className="metric-value">{metric.value}</strong>
            <span className="metric-trend">{metric.trend}</span>
          </article>
        ))}
      </section>

      <section className="dashboard-grid">
        <article className="panel">
          <p className="eyebrow">Market Snapshot</p>
          <h2>Major indexes</h2>
          <p className="market-meta muted">
            {marketStatus.isLoading
              ? 'Loading live market data...'
              : `Source: ${marketStatus.source} | Updated: ${formatTime(marketStatus.updatedAt)}`}
          </p>
          {marketStatus.warning ? <p className="market-meta muted">{marketStatus.warning}</p> : null}
          {marketStatus.error ? <p className="market-meta text-down">{marketStatus.error}</p> : null}
          <div className="market-list">
            {indexes.map((item) => (
              <div key={item.symbol} className="market-row">
                <div>
                  <strong>{item.code}</strong>
                  <p className="market-name">{item.name}</p>
                </div>
                <span className="market-price">{formatCurrency(item.price)}</span>
                <span className={getTrendClass(item.changePercent)}>
                  {formatPercent(item.changePercent)} ({formatPoints(item.change)})
                </span>
              </div>
            ))}
          </div>
        </article>

        <article className="panel">
          <p className="eyebrow">Recent Activity</p>
          <h2>Execution log</h2>
          <div className="activity-list">
            {activities.map((entry) => (
              <div key={`${entry.time}-${entry.symbol}-${entry.action}`} className="activity-row">
                <div>
                  <strong>{entry.action} {entry.qty} {entry.symbol}</strong>
                  <p>{entry.note}</p>
                </div>
                <span>{entry.time}</span>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="insight-grid">
        <article className="panel">
          <p className="eyebrow">Growth Missions</p>
          <h2>Daily execution goals</h2>
          <div className="insight-list">
            {missions.map((item) => (
              <div key={item.title} className="insight-row">
                <div>
                  <strong>{item.title}</strong>
                  <p>{item.status}</p>
                </div>
                <span>{item.eta}</span>
              </div>
            ))}
          </div>
        </article>

        <article className="panel">
          <p className="eyebrow">Focus Watchlist</p>
          <h2>Setups to monitor</h2>
          <div className="insight-list">
            {watchlist.map((item) => (
              <div key={item.symbol} className="insight-row">
                <div>
                  <strong>{item.symbol} - {item.setup}</strong>
                  <p>{item.level}</p>
                </div>
                <span>{item.bias}</span>
              </div>
            ))}
          </div>
        </article>
      </section>
    </div>
  );
};

export default Dashboard;
