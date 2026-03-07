import { useState, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { useAuth } from './AuthContext';
import * as onboardingApi from '../api/onboarding';
import iconBrand from '../assets/icons/Weather-Cloud-Wind-4--Streamline-Ultimate.svg';
import iconSkipTrace from '../assets/icons/run-trace.png';
import iconRoofMeasure from '../assets/icons/Measure-Caliber-1--Streamline-Ultimate.png';

function formatPhone(value) {
  const digits = value.replace(/\D/g, '').slice(0, 10);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || '');

const STEPS = [
  { id: 1, label: 'Account' },
  { id: 2, label: 'Company' },
  { id: 3, label: 'Plan' },
  { id: 4, label: 'Payment' },
  { id: 5, label: 'Add-ons' },
];

/* ---- Step Indicator ---- */
function StepIndicator({ currentStep, onGoToStep }) {
  return (
    <nav
      aria-label="Onboarding progress"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 0,
        marginBottom: 'var(--space-2xl)',
      }}
    >
      {STEPS.map((step, idx) => {
        const isDone = currentStep > step.id;
        const isActive = currentStep === step.id;
        const isLast = idx === STEPS.length - 1;
        const canClick = isDone;

        return (
          <div
            key={step.id}
            style={{ display: 'flex', alignItems: 'center', gap: 0 }}
          >
            <div
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--space-xs)', cursor: canClick ? 'pointer' : 'default' }}
              onClick={canClick ? () => onGoToStep(step.id) : undefined}
            >
              <div
                aria-current={isActive ? 'step' : undefined}
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 'var(--radius-pill)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 12,
                  fontWeight: 700,
                  transition: 'all 0.25s var(--ease-out)',
                  background: isDone
                    ? 'var(--accent-blue)'
                    : isActive
                    ? 'oklch(0.72 0.19 250 / 0.25)'
                    : 'oklch(0.22 0.02 260 / 0.6)',
                  border: isDone
                    ? '2px solid var(--accent-blue)'
                    : isActive
                    ? '2px solid var(--accent-blue)'
                    : '2px solid oklch(0.35 0.03 260 / 0.5)',
                  color: isDone
                    ? 'oklch(0.12 0.02 260)'
                    : isActive
                    ? 'var(--accent-blue)'
                    : 'var(--text-muted)',
                }}
              >
                {isDone ? (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                ) : (
                  step.id
                )}
              </div>
              <span
                style={{
                  fontSize: 10,
                  fontWeight: isActive ? 700 : 500,
                  color: isActive ? 'var(--text-primary)' : 'var(--text-muted)',
                  letterSpacing: '0.04em',
                  textTransform: 'uppercase',
                  whiteSpace: 'nowrap',
                  transition: 'color 0.25s var(--ease-out)',
                }}
              >
                {step.label}
              </span>
            </div>
            {!isLast && (
              <div
                aria-hidden="true"
                style={{
                  width: 36,
                  height: 2,
                  margin: '-12px var(--space-sm) 0',
                  borderRadius: 'var(--radius-pill)',
                  background: isDone
                    ? 'var(--accent-blue)'
                    : 'oklch(0.30 0.02 260 / 0.5)',
                  transition: 'background 0.3s var(--ease-out)',
                  flexShrink: 0,
                }}
              />
            )}
          </div>
        );
      })}
    </nav>
  );
}

/* ---- Logo Header ---- */
function OnboardingLogo() {
  return (
    <div className="auth-card__logo">
      <div className="sidebar__logo" style={{ width: 44, height: 44 }}>
        <img src={iconBrand} alt="StormLeads" width="36" height="36" />
      </div>
      <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: '-0.02em' }}>StormLeads</div>
    </div>
  );
}

/* ============================================================
   STEP 1 — Create Account
   ============================================================ */
function StepAccount({ onNext }) {
  const { createTenant } = useAuth();
  const [form, setForm] = useState({
    companyName: '',
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    phone: '',
  });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await createTenant({
        companyName: form.companyName,
        firstName: form.firstName,
        lastName: form.lastName,
        email: form.email,
        password: form.password,
        phone: form.phone || undefined,
      });
      onNext();
    } catch (err) {
      setError(err.response?.data?.error || 'Could not create account. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <div className="auth-card__title">Create your account</div>
      <div className="auth-card__subtitle">Start your 14-day free trial. No credit card required.</div>

      {error && <div className="auth-error" role="alert">{error}</div>}

      <form className="auth-form" onSubmit={handleSubmit} noValidate>
        <div className="form-group">
          <label htmlFor="ob-company">Company Name</label>
          <input
            id="ob-company"
            className="form-input"
            type="text"
            placeholder="Acme Roofing Co."
            value={form.companyName}
            onChange={set('companyName')}
            required
            autoComplete="organization"
            autoFocus
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 'var(--space-md)' }}>
          <div className="form-group">
            <label htmlFor="ob-first">First Name</label>
            <input
              id="ob-first"
              className="form-input"
              type="text"
              placeholder="Brandon"
              value={form.firstName}
              onChange={set('firstName')}
              required
              autoComplete="given-name"
            />
          </div>
          <div className="form-group">
            <label htmlFor="ob-last">Last Name</label>
            <input
              id="ob-last"
              className="form-input"
              type="text"
              placeholder="Lowery"
              value={form.lastName}
              onChange={set('lastName')}
              required
              autoComplete="family-name"
            />
          </div>
        </div>

        <div className="form-group">
          <label htmlFor="ob-email">Email</label>
          <input
            id="ob-email"
            className="form-input"
            type="email"
            placeholder="you@company.com"
            value={form.email}
            onChange={set('email')}
            required
            autoComplete="email"
          />
        </div>

        <div className="form-group">
          <label htmlFor="ob-password">Password</label>
          <input
            id="ob-password"
            className="form-input"
            type="password"
            placeholder="At least 8 characters"
            value={form.password}
            onChange={set('password')}
            required
            minLength={8}
            autoComplete="new-password"
          />
        </div>

        <div className="form-group">
          <label htmlFor="ob-phone">
            Phone{' '}
            <span style={{ fontWeight: 400, color: 'var(--text-muted)', textTransform: 'none', letterSpacing: 0, fontSize: 11 }}>
              (optional)
            </span>
          </label>
          <input
            id="ob-phone"
            className="form-input"
            type="tel"
            placeholder="(555) 000-0000"
            value={form.phone}
            onChange={(e) => setForm((f) => ({ ...f, phone: formatPhone(e.target.value) }))}
            autoComplete="tel"
          />
        </div>

        <button className="auth-btn" type="submit" disabled={submitting} style={{ width: '100%', height: 42, fontSize: 14 }}>
          {submitting ? 'Creating account...' : 'Create Account'}
        </button>
      </form>

      <div className="auth-link">
        Already have an account? <Link to="/login">Sign in</Link>
      </div>
    </>
  );
}

/* ============================================================
   STEP 2 — Company Details
   ============================================================ */
function StepCompany({ onNext, onSkip }) {
  const [form, setForm] = useState({ companyPhone: '', companyWebsite: '', companyAddress: '' });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await onboardingApi.updateOrg({
        companyPhone: form.companyPhone || undefined,
        companyWebsite: form.companyWebsite || undefined,
        companyAddress: form.companyAddress || undefined,
      });
      onNext();
    } catch (err) {
      setError(err.response?.data?.error || 'Could not save company details.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>

      <div className="auth-card__title">Company details</div>
      <div className="auth-card__subtitle">Help customers and teammates find you. These can be changed later.</div>

      {error && <div className="auth-error" role="alert">{error}</div>}

      <form className="auth-form" onSubmit={handleSubmit} noValidate>
        <div className="form-group">
          <label htmlFor="ob-cphone">Company Phone</label>
          <input
            id="ob-cphone"
            className="form-input"
            type="tel"
            placeholder="(555) 000-0000"
            value={form.companyPhone}
            onChange={(e) => setForm((f) => ({ ...f, companyPhone: formatPhone(e.target.value) }))}
            autoComplete="tel"
          />
        </div>

        <div className="form-group">
          <label htmlFor="ob-web">Website</label>
          <input
            id="ob-web"
            className="form-input"
            type="url"
            placeholder="https://yourcompany.com"
            value={form.companyWebsite}
            onChange={set('companyWebsite')}
            autoComplete="url"
          />
        </div>

        <div className="form-group">
          <label htmlFor="ob-addr">Address</label>
          <input
            id="ob-addr"
            className="form-input"
            type="text"
            placeholder="123 Main St, Springfield, IL 62701"
            value={form.companyAddress}
            onChange={set('companyAddress')}
            autoComplete="street-address"
          />
        </div>

        <button className="auth-btn" type="submit" disabled={submitting} style={{ width: '100%', height: 42, fontSize: 14 }}>
          {submitting ? 'Saving...' : 'Continue'}
        </button>
      </form>

      <div className="auth-link">
        <button
          type="button"
          onClick={onSkip}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: 'var(--text-muted)',
            fontSize: 13,
            padding: 0,
            transition: 'color 0.2s',
          }}
          onMouseOver={(e) => { e.currentTarget.style.color = 'var(--text-secondary)'; }}
          onMouseOut={(e) => { e.currentTarget.style.color = 'var(--text-muted)'; }}
        >
          Skip for now
        </button>
      </div>
    </>
  );
}

/* ============================================================
   STEP 3 — Choose Plan
   ============================================================ */
function PlanCard({ plan, isSelected, isRecommended, onSelect }) {
  const price = plan.price_cents === 0 ? 'Free' : `$${(plan.price_cents / 100).toFixed(0)}/mo`;

  return (
    <button
      type="button"
      onClick={() => onSelect(plan.key)}
      aria-pressed={isSelected}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-lg)',
        padding: 'var(--space-xl)',
        borderRadius: 'var(--radius-lg)',
        border: isSelected
          ? '2px solid var(--accent-blue)'
          : isRecommended
          ? '2px solid oklch(0.72 0.19 250 / 0.35)'
          : '2px solid oklch(0.30 0.02 260 / 0.4)',
        background: isSelected
          ? 'oklch(0.72 0.19 250 / 0.12)'
          : isRecommended
          ? 'oklch(0.72 0.19 250 / 0.06)'
          : 'oklch(0.16 0.015 260 / 0.6)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        cursor: 'pointer',
        textAlign: 'left',
        transition: 'all 0.2s var(--ease-out)',
        position: 'relative',
        boxShadow: isRecommended
          ? '0 0 32px oklch(0.72 0.19 250 / 0.15), 0 4px 16px oklch(0 0 0 / 0.3)'
          : '0 4px 16px oklch(0 0 0 / 0.2)',
        flex: '1 1 0',
        minWidth: 0,
      }}
    >
      {isRecommended && (
        <div
          style={{
            position: 'absolute',
            top: -11,
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'var(--accent-blue)',
            color: 'oklch(0.12 0.02 260)',
            fontSize: 10,
            fontWeight: 800,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            padding: '3px 10px',
            borderRadius: 'var(--radius-pill)',
            whiteSpace: 'nowrap',
          }}
        >
          Recommended
        </div>
      )}

      <div>
        <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>
          {plan.name}
        </div>
        <div style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-0.03em', color: isSelected ? 'var(--accent-blue)' : 'var(--text-primary)' }}>
          {price}
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)', flex: 1 }}>
        {plan.features && plan.features.map((feature, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--space-sm)' }}>
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="var(--accent-green)"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ flexShrink: 0, marginTop: 1 }}
              aria-hidden="true"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
            <span style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.4 }}>{feature}</span>
          </div>
        ))}
      </div>

      <div
        style={{
          display: 'flex',
          gap: 'var(--space-md)',
          padding: 'var(--space-md)',
          borderRadius: 'var(--radius-sm)',
          background: 'oklch(0.12 0.015 260 / 0.5)',
        }}
      >
        <div style={{ flex: 1, textAlign: 'center' }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>
            {plan.max_users === -1 ? 'Unlimited' : plan.max_users}
          </div>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Users</div>
        </div>
        <div style={{ width: 1, background: 'var(--glass-border)' }} />
        <div style={{ flex: 1, textAlign: 'center' }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>
            {plan.max_leads === -1 ? 'Unlimited' : plan.max_leads?.toLocaleString()}
          </div>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Leads</div>
        </div>
      </div>

      <div
        style={{
          height: 36,
          borderRadius: 'var(--radius-md)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 13,
          fontWeight: 700,
          background: isSelected ? 'var(--accent-blue)' : 'oklch(0.28 0.04 250 / 0.4)',
          color: isSelected ? 'oklch(0.12 0.02 260)' : 'var(--accent-blue)',
          border: isSelected ? 'none' : '1px solid oklch(0.72 0.19 250 / 0.3)',
          transition: 'all 0.2s var(--ease-out)',
        }}
      >
        {isSelected ? 'Selected' : 'Select Plan'}
      </div>
    </button>
  );
}

function StepPlan({ onNext }) {
  const [plans, setPlans] = useState([]);
  const [selectedKey, setSelectedKey] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    onboardingApi.getPlans()
      .then(({ data }) => setPlans(data.plans || []))
      .catch(() => setError('Could not load plans. Please refresh.'))
      .finally(() => setLoading(false));
  }, []);

  const handleSubmit = async () => {
    if (!selectedKey) {
      setError('Please select a plan to continue.');
      return;
    }
    setError('');
    setSubmitting(true);
    try {
      await onboardingApi.selectPlan(selectedKey);
      onNext();
    } catch (err) {
      setError(err.response?.data?.error || 'Could not select plan. Try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const RECOMMENDED_KEY = 'pro';

  return (
    <>

      <div className="auth-card__title">Choose your plan</div>
      <div className="auth-card__subtitle">All plans include a 14-day free trial. Cancel anytime.</div>

      {error && <div className="auth-error" role="alert" style={{ marginTop: 'var(--space-md)' }}>{error}</div>}

      {loading ? (
        <div style={{ textAlign: 'center', padding: 'var(--space-3xl)', color: 'var(--text-muted)' }}>
          Loading plans...
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 'var(--space-lg)', alignItems: 'stretch' }}>
          {plans.map((plan) => (
            <PlanCard
              key={plan.key}
              plan={plan}
              isSelected={selectedKey === plan.key}
              isRecommended={plan.key === RECOMMENDED_KEY}
              onSelect={setSelectedKey}
            />
          ))}
        </div>
      )}

      <button
        className="auth-btn"
        type="button"
        onClick={handleSubmit}
        disabled={submitting || !selectedKey || loading}
        style={{ width: '100%', height: 42, fontSize: 14 }}
      >
        {submitting ? 'Saving...' : 'Continue with Selected Plan'}
      </button>
    </>
  );
}

/* ============================================================
   STEP 4 — Payment Method
   ============================================================ */
const CARD_ELEMENT_OPTIONS = {
  style: {
    base: {
      color: 'oklch(0.95 0.005 260)',
      fontFamily: "'Plus Jakarta Sans', system-ui, -apple-system, sans-serif",
      fontSize: '14px',
      fontSmoothing: 'antialiased',
      '::placeholder': {
        color: 'oklch(0.55 0.01 260)',
      },
    },
    invalid: {
      color: 'oklch(0.68 0.22 25)',
      iconColor: 'oklch(0.68 0.22 25)',
    },
  },
};

function PaymentForm({ onNext, onSkip }) {
  const stripe = useStripe();
  const elements = useElements();
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!stripe || !elements) return;

    setError('');
    setSubmitting(true);

    const cardElement = elements.getElement(CardElement);

    try {
      const { error: stripeError, paymentMethod } = await stripe.createPaymentMethod({
        type: 'card',
        card: cardElement,
      });

      if (stripeError) {
        setError(stripeError.message || 'Card error. Please try again.');
        return;
      }

      await onboardingApi.setupPayment(paymentMethod.id);
      onNext();
    } catch (err) {
      setError(err.response?.data?.error || 'Could not save payment method.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>

      <div className="auth-card__title">Payment method</div>
      <div className="auth-card__subtitle">
        Your free trial starts today. You will not be charged until your trial ends.
      </div>

      {error && <div className="auth-error" role="alert">{error}</div>}

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)' }}>
        <div
          style={{
            padding: 'var(--space-lg)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--glass-border)',
            background: 'oklch(0.14 0.02 260 / 0.6)',
            backdropFilter: 'blur(12px)',
          }}
        >
          <CardElement options={CARD_ELEMENT_OPTIONS} />
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-sm)',
            padding: 'var(--space-md) var(--space-lg)',
            borderRadius: 'var(--radius-md)',
            background: 'oklch(0.75 0.18 155 / 0.06)',
            border: '1px solid oklch(0.75 0.18 155 / 0.2)',
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--accent-green)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
          <span style={{ fontSize: 12, color: 'var(--accent-green)' }}>
            Secured by Stripe. We never store your card details.
          </span>
        </div>

        <button
          className="auth-btn"
          type="submit"
          disabled={submitting || !stripe}
          style={{ width: '100%', height: 42, fontSize: 14 }}
        >
          {submitting ? 'Saving card...' : 'Save Payment Method'}
        </button>
      </form>

      <div className="auth-link">
        <button
          type="button"
          onClick={onSkip}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: 'var(--text-muted)',
            fontSize: 13,
            padding: 0,
            transition: 'color 0.2s',
          }}
          onMouseOver={(e) => { e.currentTarget.style.color = 'var(--text-secondary)'; }}
          onMouseOut={(e) => { e.currentTarget.style.color = 'var(--text-muted)'; }}
        >
          Start free trial without a card
        </button>
      </div>
    </>
  );
}

function StepPayment({ onNext, onSkip }) {
  return (
    <Elements stripe={stripePromise}>
      <PaymentForm onNext={onNext} onSkip={onSkip} />
    </Elements>
  );
}

/* ============================================================
   STEP 5 — Add-ons
   ============================================================ */
function ToggleSwitch({ checked, onChange, id }) {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      style={{
        width: 44,
        height: 24,
        borderRadius: 12,
        padding: 2,
        flexShrink: 0,
        background: checked ? 'var(--accent-green)' : 'oklch(0.30 0.02 260 / 0.6)',
        border: '1px solid var(--glass-border)',
        transition: 'all 0.2s var(--ease-out)',
        position: 'relative',
        cursor: 'pointer',
      }}
    >
      <span
        aria-hidden="true"
        style={{
          display: 'block',
          width: 18,
          height: 18,
          borderRadius: 9,
          background: 'var(--text-primary)',
          transition: 'transform 0.2s var(--ease-spring)',
          transform: checked ? 'translateX(20px)' : 'translateX(0)',
        }}
      />
    </button>
  );
}

function AddonCard({ title, description, price, icon, checked, onChange, toggleId }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--space-lg)',
        padding: 'var(--space-xl)',
        borderRadius: 'var(--radius-lg)',
        border: checked
          ? '1px solid var(--accent-green)'
          : '1px solid var(--glass-border)',
        background: checked
          ? 'oklch(0.75 0.18 155 / 0.06)'
          : 'oklch(0.16 0.015 260 / 0.6)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        transition: 'all 0.22s var(--ease-out)',
        cursor: 'pointer',
      }}
      onClick={() => onChange(!checked)}
    >
      <img src={icon} alt="" width="28" height="28" style={{ flexShrink: 0, opacity: 0.9 }} />

      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 2 }}>
          {title}
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
          {description}
        </div>
        <div
          style={{
            marginTop: 'var(--space-sm)',
            display: 'inline-block',
            fontSize: 11,
            fontWeight: 600,
            color: 'var(--text-muted)',
            letterSpacing: '0.02em',
          }}
        >
          {price}
        </div>
      </div>

      <div
        onClick={(e) => e.stopPropagation()}
        style={{ paddingTop: 0 }}
      >
        <ToggleSwitch
          id={toggleId}
          checked={checked}
          onChange={onChange}
        />
      </div>
    </div>
  );
}

function StepAddons({ onComplete }) {
  const navigate = useNavigate();
  const [skipTrace, setSkipTrace] = useState(false);
  const [roofMeasurement, setRoofMeasurement] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    setError('');
    setSubmitting(true);
    try {
      await onboardingApi.enableAddons({ skipTrace, roofMeasurement });
      await onboardingApi.completeOnboarding();
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.error || 'Could not complete setup. Try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>

      <div className="auth-card__title">Supercharge with add-ons</div>
      <div className="auth-card__subtitle">
        Pay only when you use them. Enable or disable anytime in Settings.
      </div>

      {error && <div className="auth-error" role="alert">{error}</div>}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)' }}>
        <AddonCard
          title="Skip Trace"
          description="Instantly look up contact info for property owners — phone, email, and mailing address from public records."
          price="$0.20 per record"
          icon={iconSkipTrace}
          checked={skipTrace}
          onChange={setSkipTrace}
          toggleId="toggle-skip-trace"
        />
        <AddonCard
          title="Roof Measurements"
          description="Order detailed aerial roof measurements with pitch, slope, and material estimates for accurate quotes."
          price="$0.10 per measurement"
          icon={iconRoofMeasure}
          checked={roofMeasurement}
          onChange={setRoofMeasurement}
          toggleId="toggle-roof-measurement"
        />
      </div>

      <div
        style={{
          padding: 'var(--space-md) var(--space-lg)',
          borderRadius: 'var(--radius-md)',
          background: 'oklch(0.22 0.02 260 / 0.5)',
          border: '1px solid var(--glass-border)',
          fontSize: 12,
          color: 'var(--text-muted)',
          lineHeight: 1.5,
        }}
      >
        Add-on charges are billed monthly based on actual usage. Pricing shown is per transaction.
      </div>

      <button
        className="auth-btn"
        type="button"
        onClick={handleSubmit}
        disabled={submitting}
        style={{ width: '100%', height: 42, fontSize: 14 }}
      >
        {submitting ? 'Finishing setup...' : 'Go to Dashboard'}
      </button>
    </>
  );
}

/* ============================================================
   MAIN ONBOARDING PAGE
   ============================================================ */
export default function OnboardingPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  // If step 1 already done (user exists in context), start at step 2
  const [step, setStep] = useState(user ? 2 : 1);

  // Redirect to dashboard if somehow fully authenticated without onboarding path
  useEffect(() => {
    if (user && user.onboardingComplete) {
      navigate('/', { replace: true });
    }
  }, [user, navigate]);

  const next = useCallback(() => setStep((s) => Math.min(s + 1, 5)), []);
  const skip = useCallback(() => setStep((s) => Math.min(s + 1, 5)), []);
  const goToStep = useCallback((s) => setStep(s), []);

  // The plan step needs a wider card
  const isWidePlan = step === 3;

  return (
    <div
      className="auth-page"
      style={{
        alignItems: 'center',
        justifyContent: 'center',
        padding: 'var(--space-xl)',
        overflowY: 'auto',
        minHeight: '100vh',
      }}
    >
      <div
        className="glass"
        style={{
          width: '100%',
          maxWidth: isWidePlan ? 900 : 520,
          borderRadius: 'var(--radius-xl)',
          padding: 'var(--space-3xl)',
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-xl)',
          margin: '0 auto',
          transition: 'max-width 0.3s var(--ease-out)',
        }}
        role="main"
        aria-label="Onboarding wizard"
      >
        <OnboardingLogo />
        <StepIndicator currentStep={step} onGoToStep={goToStep} />

        {step === 1 && <StepAccount onNext={next} />}
        {step === 2 && <StepCompany onNext={next} onSkip={skip} />}
        {step === 3 && <StepPlan onNext={next} />}
        {step === 4 && <StepPayment onNext={next} onSkip={skip} />}
        {step === 5 && <StepAddons />}
      </div>
    </div>
  );
}
