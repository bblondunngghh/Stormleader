import { createContext, useContext, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import * as authApi from '../api/auth';
import * as onboardingApi from '../api/onboarding';
import client from '../api/client';

const AuthContext = createContext(null);

const DEV_BYPASS = import.meta.env.VITE_DEV_BYPASS_AUTH === 'true';
const DEV_USER = {
  id: '93fb33ea-e7d8-461f-87e4-bba4e55acc9e', firstName: 'Brandon', lastName: 'Admin', email: 'brandon',
  role: 'super_admin', tenantId: '791bb51d-3293-4839-92e9-bd4d4f873af2',
};

export function AuthProvider({ children }) {
  const [user, setUser] = useState(DEV_BYPASS ? DEV_USER : null);
  const [token, setToken] = useState(DEV_BYPASS ? 'dev-bypass' : null);
  const [loading, setLoading] = useState(!DEV_BYPASS);
  const navigate = useNavigate();

  useEffect(() => {
    if (DEV_BYPASS) return;
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
    // Clear map session state so storm map starts fresh each login
    ['stormMapLayers', 'stormMapImprovedOnly', 'stormMapViewport', 'stormMapPopup'].forEach(k => sessionStorage.removeItem(k));
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
