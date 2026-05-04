export const formatCurrency = (value) => {
  if (typeof value !== 'number') {
    return '--';
  }

  return `$${value.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
};

export const formatPercent = (value) => {
  if (typeof value !== 'number') {
    return '--';
  }

  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(2)}%`;
};

export const formatTime = (iso) => {
  if (!iso) {
    return '--';
  }

  return new Date(iso).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
};

export const getTrendClass = (changePercent) => {
  if (typeof changePercent !== 'number' || changePercent === 0) {
    return 'trend';
  }

  return changePercent > 0 ? 'trend up' : 'trend down';
};
