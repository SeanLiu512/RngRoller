import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import { db } from '@/api/client';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [authError, setAuthError] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);

  // If we just landed here from the Google OAuth redirect, pick up the
  // token from the URL and clean it out of the address bar.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tokenFromUrl = params.get('access_token');
    if (tokenFromUrl) {
      db.auth.setToken(tokenFromUrl);
      params.delete('access_token');
      const newUrl = `${window.location.pathname}${params.toString() ? `?${params.toString()}` : ''}`;
      window.history.replaceState({}, document.title, newUrl);
    }
  }, []);

  const checkUserAuth = useCallback(async () => {
    setIsLoadingAuth(true);
    setAuthError(null);
    try {
      const currentUser = await db.auth.me();
      if (currentUser.banned) {
        setAuthError({ type: 'user_banned', message: 'Your account has been banned.' });
        setUser(null);
        setIsAuthenticated(false);
      } else {
        setUser(currentUser);
        setIsAuthenticated(true);
      }
    } catch (error) {
      setUser(null);
      setIsAuthenticated(false);
      // A 401/403 here just means "not logged in", which is a normal state
      // for public pages (Home, Shop, Arena, Leaderboard) — it is NOT an
      // app-wide error. Route-level protection for /profile and /admin is
      // handled separately by <ProtectedRoute>, so we deliberately do not
      // set authError (and do not redirect) here.
    } finally {
      setIsLoadingAuth(false);
      setAuthChecked(true);
    }
  }, []);

  useEffect(() => {
    checkUserAuth();
  }, [checkUserAuth]);

  const logout = () => {
    db.auth.logout('/');
    setUser(null);
    setIsAuthenticated(false);
    window.location.href = '/';
  };

  const navigateToLogin = () => {
    db.auth.redirectToLogin();
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated,
        isLoadingAuth,
        isLoadingPublicSettings: false,
        authError,
        appPublicSettings: null,
        authChecked,
        logout,
        navigateToLogin,
        checkUserAuth,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
