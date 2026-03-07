import { createContext, useContext, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import * as authApi from '../api/auth';
import * as onboardingApi from '../api/onboarding';
import client from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const storedToken = localStorage.getItem('token');
    const storedUser = localStorage.getItem('user');

    if (storedToken && storedUser) {
      setToken(storedToken);
      setUser(JSON.parse(storedUser));
      // Validate token by calling a lightweight endpoint
      client.get('/auth/me')
        .then(({ data }) => {
          const resolvedUser = data.user || JSON.parse(storedUser);
          setUser(resolvedUser);
          if (data.tenant) {
            localStorage.setItem('tenant', JSON.stringify(data.tenant));
          }
        })
        .catch(() => {
          // Token invalid — keep local data, refresh will handle it
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (email, password, tenantSlug) => {
    const { data } = await authApi.login(email, password, tenantSlug);
    localStorage.setItem('token', data.accessToken);
    localStorage.setItem('refreshToken', data.refreshToken);
    localStorage.setItem('user', JSON.stringify(data.user));
    setToken(data.accessToken);
    setUser(data.user);
    navigate('/');
  };

  const register = async ({ firstName, lastName, email, password, tenantSlug }) => {
    const { data } = await authApi.register({ firstName, lastName, email, password, tenantSlug });
    localStorage.setItem('token', data.accessToken);
    localStorage.setItem('refreshToken', data.refreshToken);
    localStorage.setItem('user', JSON.stringify(data.user));
    setToken(data.accessToken);
    setUser(data.user);
    navigate('/');
  };

  const createTenant = async ({ companyName, firstName, lastName, email, password, phone }) => {
    const { data } = await onboardingApi.createTenant({ companyName, firstName, lastName, email, password, phone });
    localStorage.setItem('token', data.accessToken);
    localStorage.setItem('refreshToken', data.refreshToken);
    localStorage.setItem('user', JSON.stringify(data.user));
    if (data.tenant) {
      localStorage.setItem('tenant', JSON.stringify(data.tenant));
    }
    setToken(data.accessToken);
    setUser(data.user);
    // Do NOT navigate here — the OnboardingPage manages step state
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
    localStorage.removeItem('tenant');
    setToken(null);
    setUser(null);
    navigate('/login');
  };

  return (
    <AuthContext.Provider value={{ user, token, login, register, createTenant, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
