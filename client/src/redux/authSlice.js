import { createSlice } from '@reduxjs/toolkit';

const canUseStorage = typeof window !== 'undefined' && !!window.localStorage;

const getStoredAuth = () => {
  if (!canUseStorage) {
    return { user: null, token: null };
  }

  try {
    const rawAuth = window.localStorage.getItem('auth');
    if (!rawAuth) {
      return { user: null, token: null };
    }

    const parsedAuth = JSON.parse(rawAuth);
    return {
      user: parsedAuth.user || null,
      token: parsedAuth.token || null,
    };
  } catch (_error) {
    return { user: null, token: null };
  }
};

const persistAuth = ({ user, token }) => {
  if (!canUseStorage) {
    return;
  }

  window.localStorage.setItem('auth', JSON.stringify({ user, token }));
};

const clearPersistedAuth = () => {
  if (!canUseStorage) {
    return;
  }

  window.localStorage.removeItem('auth');
};

const initialState = getStoredAuth();

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setCredentials(state, action) {
      const { user, token } = action.payload;
      state.user = user;
      state.token = token;
      persistAuth({ user, token });
    },
    logout(state) {
      state.user = null;
      state.token = null;
      clearPersistedAuth();
    },
  },
});

export const { setCredentials, logout } = authSlice.actions;
export default authSlice.reducer;
