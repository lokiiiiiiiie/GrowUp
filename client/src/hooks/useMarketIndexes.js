import { useEffect, useState } from 'react';
import api from '../api/client';

export const defaultIndexes = [
  { symbol: '^GSPC', code: 'SPX', name: 'S&P 500', price: null, change: null, changePercent: null },
  { symbol: '^NDX', code: 'NDX', name: 'Nasdaq 100', price: null, change: null, changePercent: null },
  { symbol: '^DJI', code: 'DJI', name: 'Dow Jones', price: null, change: null, changePercent: null },
  { symbol: '^RUT', code: 'RUT', name: 'Russell 2000', price: null, change: null, changePercent: null },
];

const POLL_INTERVAL_MS = 5000;

const normalizeIndexes = (indexes) =>
  Array.isArray(indexes) && indexes.length > 0 ? indexes : defaultIndexes;

const getStreamUrl = () => {
  const baseUrl = api.defaults.baseURL || '';

  if (!baseUrl) {
    return '/api/market/indexes/stream';
  }

  return `${baseUrl.replace(/\/$/, '')}/api/market/indexes/stream`;
};

const useMarketIndexes = () => {
  const [indexes, setIndexes] = useState(defaultIndexes);
  const [marketStatus, setMarketStatus] = useState({
    isLoading: true,
    source: '',
    updatedAt: '',
    error: '',
    warning: '',
  });

  useEffect(() => {
    let isActive = true;
    let pollTimerId = null;
    let eventSource = null;

    const applyPayload = (payload) => {
      if (!isActive) {
        return;
      }

      setIndexes(normalizeIndexes(payload?.indexes));
      setMarketStatus({
        isLoading: false,
        source: payload?.source || 'unknown',
        updatedAt: payload?.generatedAt || new Date().toISOString(),
        error: '',
        warning: payload?.warning || '',
      });
    };

    const setLoadError = () => {
      if (!isActive) {
        return;
      }

      setMarketStatus((current) => ({
        ...current,
        isLoading: false,
        error: 'Unable to load market indexes right now.',
      }));
    };

    const loadIndexes = async () => {
      try {
        const { data } = await api.get('/api/market/indexes');
        applyPayload(data);
      } catch (_error) {
        setLoadError();
      }
    };

    const startStreaming = () => {
      if (typeof EventSource !== 'function') {
        return;
      }

      eventSource = new EventSource(getStreamUrl());

      eventSource.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          applyPayload(payload);
        } catch (_error) {
          // Ignore malformed events and wait for the next update.
        }
      };

      eventSource.onerror = () => {
        if (eventSource) {
          eventSource.close();
          eventSource = null;
        }
      };
    };

    loadIndexes();
    pollTimerId = setInterval(loadIndexes, POLL_INTERVAL_MS);
    startStreaming();

    return () => {
      isActive = false;

      if (eventSource) {
        eventSource.close();
      }

      if (pollTimerId) {
        clearInterval(pollTimerId);
      }
    };
  }, []);

  return { indexes, marketStatus };
};

export default useMarketIndexes;
