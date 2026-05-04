import axios from 'axios';
import { logout, setCredentials } from '../redux/authSlice';
import store from '../redux/store';

const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL || 'http://localhost:5000',
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

const AUTH_EXCLUDED_REFRESH_PATHS = [
  '/api/auth/login',
  '/api/auth/register',
  '/api/auth/refresh',
  '/api/auth/logout',
  '/api/auth/logout-all',
];
let refreshPromise = null;

const updateLocalAuth = (payload) => {
  if (!payload?.token || !payload?.user) {
    return;
  }

  store.dispatch(
    setCredentials({
      user: payload.user,
      token: payload.token,
    })
  );
};

const clearLocalAuth = () => {
  store.dispatch(logout());
};

api.interceptors.request.use((config) => {
  if (typeof window === 'undefined') {
    return config;
  }

  const rawAuth = window.localStorage.getItem('auth');
  if (!rawAuth) {
    return config;
  }

  try {
    const parsedAuth = JSON.parse(rawAuth);
    if (parsedAuth?.token) {
      config.headers.Authorization = `Bearer ${parsedAuth.token}`;
    }
  } catch (_error) {
    // Ignore malformed local auth payload and continue request without token.
  }

  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config || {};
    const statusCode = error.response?.status;
    const requestUrl = originalRequest.url || '';
    const shouldSkipRefresh = AUTH_EXCLUDED_REFRESH_PATHS.some((path) => requestUrl.includes(path));

    if (statusCode !== 401 || shouldSkipRefresh || originalRequest._retry) {
      return Promise.reject(error);
    }

    originalRequest._retry = true;

    try {
      if (!refreshPromise) {
        refreshPromise = api.post('/api/auth/refresh').then((response) => {
          updateLocalAuth(response.data);
          return response.data;
        });
      }

      const refreshed = await refreshPromise;
      refreshPromise = null;

      if (refreshed?.token) {
        originalRequest.headers = {
          ...(originalRequest.headers || {}),
          Authorization: `Bearer ${refreshed.token}`,
        };
      }

      return api(originalRequest);
    } catch (refreshError) {
      refreshPromise = null;
      clearLocalAuth();
      return Promise.reject(refreshError);
    }
  }
);

export default api;
