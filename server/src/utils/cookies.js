const parseCookieHeader = (cookieHeader = '') => {
  if (!cookieHeader || typeof cookieHeader !== 'string') {
    return {};
  }

  return cookieHeader.split(';').reduce((cookies, part) => {
    const [rawName, ...rest] = part.trim().split('=');
    if (!rawName) {
      return cookies;
    }

    const value = rest.join('=');

    try {
      cookies[rawName] = decodeURIComponent(value || '');
    } catch (_error) {
      cookies[rawName] = value || '';
    }

    return cookies;
  }, {});
};

module.exports = {
  parseCookieHeader,
};
