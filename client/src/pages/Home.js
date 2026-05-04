import React from 'react';
import { Link } from 'react-router-dom';
import useMarketIndexes from '../hooks/useMarketIndexes';
import { formatCurrency, formatPercent, formatTime, getTrendClass } from '../utils/marketFormat';

const Home = () => {
  const { indexes, marketStatus } = useMarketIndexes();

  const highlights = [
    {
      title: 'Live Paper Trading Engine',
      detail: 'Practice with realistic execution flow, market prices, and instant order feedback.',
    },
    {
      title: 'Goal-Based Practice Tracks',
      detail: 'Train by target: consistency, risk management, or directional conviction.',
    },
    {
      title: 'Progress Intelligence',
      detail: 'Review wins, losses, and behavior patterns before deploying real capital.',
    },
  ];

  const learningPaths = [
    {
      title: 'Starter Mode',
      description: 'Build confidence with guided trades, daily prompts, and simple position sizing.',
      duration: '2 weeks',
    },
    {
      title: 'Execution Focus',
      description: 'Learn timing with limit entries, scenario plans, and discipline checkpoints.',
      duration: '3 weeks',
    },
    {
      title: 'Strategy Builder',
      description: 'Backtest ideas, compare setups, and turn repeatable plays into your routine.',
      duration: '4 weeks',
    },
  ];

  const quickActions = [
    {
      title: 'Open Trade Desk',
      detail: 'Place a simulated order with market or limit execution.',
      link: '/trade',
      cta: 'Launch Trade',
    },
    {
      title: 'Review Performance',
      detail: 'Check your metrics, recent actions, and momentum in one view.',
      link: '/dashboard',
      cta: 'View Dashboard',
    },
    {
      title: 'Inspect Holdings',
      detail: 'Track unrealized P/L and portfolio concentration by position.',
      link: '/portfolio',
      cta: 'Open Portfolio',
    },
  ];

  return (
    <div className="page home-page">
      <section className="panel hero-panel">
        <p className="eyebrow">GrowUp Platform</p>
        <h1>Practice smarter, build discipline, and grow your trading confidence.</h1>
        <p className="hero-copy">
          GrowUp combines market simulation, habit tracking, and guided learning so you can improve your
          decisions without financial pressure.
        </p>
        <div className="hero-actions">
          <Link to="/trade" className="btn primary">
            Start Practicing
          </Link>
          <Link to="/dashboard" className="btn ghost">
            Open Growth Dashboard
          </Link>
        </div>
        <div className="hero-stats">
          <article className="stat-tile">
            <span className="stat-value">250K+</span>
            <span className="stat-label">Practice Orders</span>
          </article>
          <article className="stat-tile">
            <span className="stat-value">48</span>
            <span className="stat-label">Learning Missions</span>
          </article>
          <article className="stat-tile">
            <span className="stat-value">87%</span>
            <span className="stat-label">Goal Completion Rate</span>
          </article>
        </div>
      </section>

      <section className="split-grid">
        <article className="panel">
          <p className="eyebrow">Why GrowUp</p>
          <h2>Built for deliberate progress</h2>
          <div className="feature-list">
            {highlights.map((item) => (
              <div key={item.title} className="feature-item">
                <h3>{item.title}</h3>
                <p>{item.detail}</p>
              </div>
            ))}
          </div>
        </article>

        <article className="panel market-panel">
          <p className="eyebrow">Market Pulse</p>
          <h2>Quick snapshot</h2>
          <p className="market-meta muted">
            {marketStatus.isLoading
              ? 'Loading live market data...'
              : `Source: ${marketStatus.source} | Updated: ${formatTime(marketStatus.updatedAt)}`}
          </p>
          {marketStatus.warning ? <p className="market-meta muted">{marketStatus.warning}</p> : null}
          {marketStatus.error ? <p className="market-meta text-down">{marketStatus.error}</p> : null}
          <div className="market-list">
            {indexes.map((index) => (
              <div key={index.symbol} className="market-row">
                <div>
                  <strong>{index.code}</strong>
                  <p className="market-name">{index.name}</p>
                </div>
                <div className="market-price">{formatCurrency(index.price)}</div>
                <div className={getTrendClass(index.changePercent)}>
                  {formatPercent(index.changePercent)}
                </div>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="panel roadmap-panel">
        <p className="eyebrow">Learning Paths</p>
        <h2>Choose how you want to improve</h2>
        <div className="roadmap-grid">
          {learningPaths.map((path) => (
            <article key={path.title} className="roadmap-card">
              <h3>{path.title}</h3>
              <p>{path.description}</p>
              <span>{path.duration}</span>
            </article>
          ))}
        </div>
      </section>

      <section className="action-grid">
        {quickActions.map((item) => (
          <article key={item.title} className="panel action-card">
            <h3>{item.title}</h3>
            <p>{item.detail}</p>
            <Link to={item.link} className="btn ghost">
              {item.cta}
            </Link>
          </article>
        ))}
      </section>
    </div>
  );
};

export default Home;
