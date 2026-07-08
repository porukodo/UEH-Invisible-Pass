import { createContext, useContext, useEffect, useState } from 'react';
import { api, setUnauthorizedHandler } from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const raw = localStorage.getItem('uip_user');
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      // Stale/corrupted value from an older app version - drop it rather
      // than letting JSON.parse throw and crash the whole React tree.
      localStorage.removeItem('uip_user');
      localStorage.removeItem('uip_token');
      return null;
    }
  });

  useEffect(() => {
    if (user) localStorage.setItem('uip_user', JSON.stringify(user));
    else localStorage.removeItem('uip_user');
  }, [user]);

  // If any request comes back 401 (expired/missing token), drop the stale
  // user so ProtectedRoute sends them back to /login instead of leaving
  // them stuck on a page that can no longer call the API.
  useEffect(() => {
    setUnauthorizedHandler(() => setUser(null));
    return () => setUnauthorizedHandler(null);
  }, []);

  async function login(email, password) {
    const { data } = await api.post('/auth/login', { email, password });
    if (data.otpBypassed) {
      localStorage.setItem('uip_token', data.token);
      setUser(data.user);
    }
    return data;
  }

  async function verifyLoginOtp(email, code) {
    const { data } = await api.post('/auth/login/verify-otp', { email, code });
    localStorage.setItem('uip_token', data.token);
    setUser(data.user);
    return data.user;
  }

  function logout() {
    localStorage.removeItem('uip_token');
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, login, verifyLoginOtp, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
