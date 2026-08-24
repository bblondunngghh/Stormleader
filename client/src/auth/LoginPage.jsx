import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { CloudIcon } from '@heroicons/react/24/outline';

export default function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState('waterlooconstruction1@gmail.com');
  const [password, setPassword] = useState('2Wealth&health');
  const [tenantSlug, setTenantSlug] = useState('waterloo');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await login(email, password, tenantSlug);
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed. Check your credentials.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card glass">
        <div className="auth-card__logo" style={{ flexDirection: 'column', alignItems: 'center', gap: 8 }}>
          <div className="sidebar__logo" style={{ width: 44, height: 44 }}><CloudIcon width={36} height={36} /></div>
          <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: '-0.02em' }}>StormPipe</div>
        </div>

        <h1 className="auth-card__title">Sign in</h1>
        <div className="auth-card__subtitle">Access your roofing CRM dashboard</div>

        {error && <div className="auth-error">{error}</div>}

        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Email</label>
            <input
              className="form-input"
              type="text"
              placeholder="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label>Password</label>
            <input
              className="form-input"
              type="password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label>Tenant</label>
            <input
              className="form-input"
              type="text"
              placeholder="creekstone"
              value={tenantSlug}
              onChange={(e) => setTenantSlug(e.target.value)}
              required
            />
          </div>

          <button className="auth-btn" type="submit" disabled={submitting}>
            {submitting ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <div className="auth-link">
          Don't have an account? <Link to="/register">Register</Link>
        </div>
      </div>
    </div>
  );
}
