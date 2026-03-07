import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from './AuthContext';
import iconBrand from '../assets/icons/Weather-Cloud-Wind-4--Streamline-Ultimate.svg';

export default function RegisterPage() {
  const { createTenant } = useAuth();
  const navigate = useNavigate();
  const [companyName, setCompanyName] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await createTenant({ companyName, firstName, lastName, email, password });
      navigate('/onboarding');
    } catch (err) {
      setError(err.response?.data?.error || 'Registration failed. Try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card glass">
        <div className="auth-card__logo">
          <div className="sidebar__logo" style={{ width: 44, height: 44 }}>
            <img src={iconBrand} alt="StormLeads" width="36" height="36" />
          </div>
          <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: '-0.02em' }}>StormLeads</div>
        </div>

        <div className="auth-card__title">Create your account</div>
        <div className="auth-card__subtitle">Start tracking storm leads today</div>

        {error && <div className="auth-error" role="alert">{error}</div>}

        <form className="auth-form" onSubmit={handleSubmit} noValidate>
          <div className="form-group">
            <label htmlFor="reg-company">Company Name</label>
            <input
              id="reg-company"
              className="form-input"
              type="text"
              placeholder="Acme Roofing Co."
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              required
              autoComplete="organization"
              autoFocus
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 'var(--space-md)' }}>
            <div className="form-group">
              <label htmlFor="reg-first">First Name</label>
              <input
                id="reg-first"
                className="form-input"
                type="text"
                placeholder="Brandon"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                required
                autoComplete="given-name"
              />
            </div>
            <div className="form-group">
              <label htmlFor="reg-last">Last Name</label>
              <input
                id="reg-last"
                className="form-input"
                type="text"
                placeholder="Lowery"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                required
                autoComplete="family-name"
              />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="reg-email">Email</label>
            <input
              id="reg-email"
              className="form-input"
              type="email"
              placeholder="you@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </div>

          <div className="form-group">
            <label htmlFor="reg-password">Password</label>
            <input
              id="reg-password"
              className="form-input"
              type="password"
              placeholder="At least 8 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              autoComplete="new-password"
            />
          </div>

          <button className="auth-btn" type="submit" disabled={submitting} style={{ width: '100%' }}>
            {submitting ? 'Creating account...' : 'Get Started'}
          </button>
        </form>

        <div className="auth-link">
          Already have an account? <Link to="/login">Sign in</Link>
        </div>
      </div>
    </div>
  );
}
