import { useState, useEffect, useRef, useMemo } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import client from '../api/client';
import { createPublicPaymentIntent } from '../api/payments';

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || 'pk_test_placeholder');

const CARD_FEE_PERCENT = 0.029;
const CARD_FEE_FLAT_CENTS = 25;
const ACH_FEE_PERCENT = 0.008;
const ACH_FEE_MAX_CENTS = 2500;

function calculateFee(amountCents, method) {
  if (method === 'ach') {
    return Math.min(Math.round(amountCents * ACH_FEE_PERCENT), ACH_FEE_MAX_CENTS);
  }
  return Math.round(amountCents * CARD_FEE_PERCENT) + CARD_FEE_FLAT_CENTS;
}

export default function PublicEstimate({ token }) {
  const [estimate, setEstimate] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [signerName, setSignerName] = useState('');
  const [signing, setSigning] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [showPayment, setShowPayment] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('card');
  const [paymentClientSecret, setPaymentClientSecret] = useState(null);
  const [paymentStripeAccount, setPaymentStripeAccount] = useState(null);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [paymentError, setPaymentError] = useState(null);
  const [paymentFeeInfo, setPaymentFeeInfo] = useState(null);
  const canvasRef = useRef(null);
  const drawingRef = useRef(false);

  useEffect(() => {
    client.get(`/estimates/public/${token}`)
      .then(res => setEstimate(res.data))
      .catch(() => setError('Estimate not found or has expired.'))
      .finally(() => setLoading(false));
  }, [token]);

  // Canvas drawing
  const startDraw = (e) => {
    drawingRef.current = true;
    const ctx = canvasRef.current.getContext('2d');
    const rect = canvasRef.current.getBoundingClientRect();
    const x = (e.clientX || e.touches?.[0]?.clientX) - rect.left;
    const y = (e.clientY || e.touches?.[0]?.clientY) - rect.top;
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const draw = (e) => {
    if (!drawingRef.current) return;
    const ctx = canvasRef.current.getContext('2d');
    const rect = canvasRef.current.getBoundingClientRect();
    const x = (e.clientX || e.touches?.[0]?.clientX) - rect.left;
    const y = (e.clientY || e.touches?.[0]?.clientY) - rect.top;
    ctx.lineTo(x, y);
    ctx.strokeStyle = '#1a1a1a';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.stroke();
  };

  const stopDraw = () => { drawingRef.current = false; };

  const clearSignature = () => {
    const ctx = canvasRef.current.getContext('2d');
    ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
  };

  const handleAccept = async () => {
    if (!signerName.trim()) return;
    setSigning(true);
    try {
      const signatureData = canvasRef.current.toDataURL('image/png');
      await client.post(`/estimates/public/${token}/accept`, {
        signer_name: signerName.trim(),
        signature_data: signatureData,
      });
      setSubmitted(true);
      setEstimate(prev => ({ ...prev, status: 'accepted' }));
    } catch {
      setError('Failed to submit. Please try again.');
    } finally {
      setSigning(false);
    }
  };

  const handleDecline = async () => {
    setSigning(true);
    try {
      await client.post(`/estimates/public/${token}/decline`);
      setEstimate(prev => ({ ...prev, status: 'declined' }));
      setSubmitted(true);
    } catch {
      setError('Failed to submit. Please try again.');
    } finally {
      setSigning(false);
    }
  };

  if (loading) {
    return (
      <div className="public-estimate-page">
        <div className="public-estimate-loading">Loading estimate...</div>
      </div>
    );
  }

  if (error && !estimate) {
    return (
      <div className="public-estimate-page">
        <div className="public-estimate-error">{error}</div>
      </div>
    );
  }

  const lineItems = estimate.line_items || [];
  const isResolved = ['accepted', 'declined', 'expired'].includes(estimate.status);
  const canPay = estimate.stripe_connected && !paymentSuccess && estimate.status !== 'paid';
  const totalCents = Math.round(Number(estimate.total) * 100);

  const handleStartPayment = async (method = 'card') => {
    setPaymentLoading(true);
    setPaymentError(null);
    setPaymentMethod(method);
    try {
      const res = await createPublicPaymentIntent({
        token,
        paymentMethod: method,
        customerEmail: estimate.customer_email,
      });
      setPaymentClientSecret(res.data.clientSecret);
      setPaymentStripeAccount(res.data.stripeAccountId);
      setPaymentFeeInfo({
        amount: res.data.amount,
        fee: res.data.applicationFee,
        net: res.data.amount - res.data.applicationFee,
      });
      setShowPayment(true);
    } catch (err) {
      setPaymentError(err.response?.data?.error || 'Unable to initiate payment. Please try again.');
    }
    setPaymentLoading(false);
  };

  const handlePaymentComplete = () => {
    setPaymentSuccess(true);
    setShowPayment(false);
    setEstimate(prev => ({ ...prev, status: 'paid' }));
  };

  return (
    <div className="public-estimate-page">
      <div className="public-estimate-card">
        {/* Header */}
        <div className="public-estimate-header">
          <div className="public-estimate-company">
            <div className="public-estimate-company__name">{estimate.company_name || 'StormPipe Roofing'}</div>
            <div className="public-estimate-company__sub">Professional Roofing Services</div>
          </div>
          <div className="public-estimate-meta">
            <div className="public-estimate-meta__number">ESTIMATE {estimate.estimate_number}</div>
            <div className="public-estimate-meta__date">
              {new Date(estimate.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
            </div>
            {estimate.valid_until && (
              <div className="public-estimate-meta__valid">
                Valid until {new Date(estimate.valid_until).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
              </div>
            )}
          </div>
        </div>

        {/* Customer */}
        {estimate.customer_name && (
          <div className="public-estimate-customer">
            <div className="public-estimate-section-title">Prepared For</div>
            <div className="public-estimate-customer__name">{estimate.customer_name}</div>
            {estimate.customer_address && <div>{estimate.customer_address}</div>}
            {estimate.customer_phone && <div>{estimate.customer_phone}</div>}
            {estimate.customer_email && <div>{estimate.customer_email}</div>}
          </div>
        )}

        {/* Line Items */}
        {lineItems.length > 0 && (
          <table className="public-estimate-table">
            <thead>
              <tr>
                <th>Description</th>
                <th>Qty</th>
                <th>Unit Price</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {lineItems.map((item, i) => (
                <tr key={i}>
                  <td>{item.description}</td>
                  <td>{item.quantity} {item.unit}</td>
                  <td>${Number(item.unit_price).toFixed(2)}</td>
                  <td>${((Number(item.quantity) || 0) * (Number(item.unit_price) || 0)).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* Totals */}
        <div className="public-estimate-totals">
          <div className="public-estimate-totals__row">
            <span>Subtotal</span>
            <span>${Number(estimate.subtotal).toFixed(2)}</span>
          </div>
          {Number(estimate.discount_value) > 0 && (
            <div className="public-estimate-totals__row">
              <span>Discount</span>
              <span style={{ color: '#dc2626' }}>
                -{estimate.discount_type === 'percent' ? `${estimate.discount_value}%` : `$${Number(estimate.discount_value).toFixed(2)}`}
              </span>
            </div>
          )}
          {Number(estimate.tax_amount) > 0 && (
            <div className="public-estimate-totals__row">
              <span>Tax</span>
              <span>${Number(estimate.tax_amount).toFixed(2)}</span>
            </div>
          )}
          <div className="public-estimate-totals__total">
            <span>Total</span>
            <span>${Number(estimate.total).toFixed(2)}</span>
          </div>
        </div>

        {/* Scope */}
        {estimate.scope_of_work && (
          <div className="public-estimate-section">
            <div className="public-estimate-section-title">Scope of Work</div>
            <p>{estimate.scope_of_work}</p>
          </div>
        )}

        {estimate.warranty_info && (
          <div className="public-estimate-section">
            <div className="public-estimate-section-title">Warranty</div>
            <p>{estimate.warranty_info}</p>
          </div>
        )}

        {estimate.terms && (
          <div className="public-estimate-terms">
            <strong>Terms & Conditions:</strong> {estimate.terms}
          </div>
        )}

        {/* Status Badge */}
        {isResolved && (
          <div className={`public-estimate-status public-estimate-status--${estimate.status}`}>
            {estimate.status === 'accepted' ? 'Accepted' : estimate.status === 'declined' ? 'Declined' : 'Expired'}
            {estimate.signed_at && (
              <span> on {new Date(estimate.signed_at).toLocaleDateString()}{estimate.signer_name ? ` by ${estimate.signer_name}` : ''}</span>
            )}
          </div>
        )}

        {/* Accept / Decline */}
        {!isResolved && !submitted && (
          <div className="public-estimate-actions">
            <div className="public-estimate-section-title">Accept This Estimate</div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', marginBottom: 4, fontSize: 13, fontWeight: 600 }}>Your Name</label>
              <input
                type="text"
                value={signerName}
                onChange={(e) => setSignerName(e.target.value)}
                placeholder="Full legal name"
                className="public-estimate-input"
              />
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', marginBottom: 4, fontSize: 13, fontWeight: 600 }}>
                Signature
                <button onClick={clearSignature} style={{ marginLeft: 12, fontSize: 11, color: '#2563eb', background: 'none', border: 'none', cursor: 'pointer' }}>Clear</button>
              </label>
              <canvas
                ref={canvasRef}
                width={400}
                height={120}
                onMouseDown={startDraw}
                onMouseMove={draw}
                onMouseUp={stopDraw}
                onMouseLeave={stopDraw}
                onTouchStart={startDraw}
                onTouchMove={draw}
                onTouchEnd={stopDraw}
                style={{
                  border: '1px solid #e2e8f0',
                  borderRadius: 8,
                  width: '100%',
                  maxWidth: 400,
                  height: 120,
                  cursor: 'crosshair',
                  touchAction: 'none',
                  background: '#fafafa',
                }}
              />
            </div>

            <div style={{ display: 'flex', gap: 12 }}>
              <button
                onClick={handleAccept}
                disabled={!signerName.trim() || signing}
                className="public-estimate-btn public-estimate-btn--accept"
              >
                {signing ? 'Submitting...' : 'Accept Estimate'}
              </button>
              <button
                onClick={handleDecline}
                disabled={signing}
                className="public-estimate-btn public-estimate-btn--decline"
              >
                Decline
              </button>
            </div>

            {error && <div style={{ color: '#dc2626', fontSize: 13, marginTop: 8 }}>{error}</div>}
          </div>
        )}

        {submitted && (
          <div className="public-estimate-status public-estimate-status--accepted">
            Thank you! Your response has been recorded.
          </div>
        )}

        {/* Payment Success */}
        {paymentSuccess && (
          <div style={{
            padding: 'var(--space-xl, 24px)', borderRadius: 12, textAlign: 'center',
            background: 'oklch(0.75 0.18 145 / 0.08)', border: '1px solid oklch(0.75 0.18 145 / 0.25)',
            marginTop: 20,
          }}>
            <div style={{
              width: 56, height: 56, borderRadius: '50%', margin: '0 auto 16px',
              background: 'oklch(0.75 0.18 145 / 0.15)', border: '2px solid oklch(0.75 0.18 145 / 0.4)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="oklch(0.75 0.18 145)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <div style={{ fontSize: 18, fontWeight: 700, color: 'oklch(0.75 0.18 145)', marginBottom: 8 }}>
              Payment Successful
            </div>
            <div style={{ fontSize: 14, color: '#666', marginBottom: 4 }}>
              ${(totalCents / 100).toFixed(2)} has been processed
            </div>
            <div style={{ fontSize: 12, color: '#999' }}>
              A receipt has been sent to {estimate.customer_email || 'your email'}
            </div>
          </div>
        )}

        {/* Paid Badge */}
        {estimate.status === 'paid' && !paymentSuccess && (
          <div className="public-estimate-status public-estimate-status--accepted">
            This estimate has been paid.
          </div>
        )}

        {/* Pay Now Section */}
        {canPay && !showPayment && (
          <div style={{
            padding: 24, borderTop: '1px solid oklch(0.85 0.02 260)', marginTop: 20,
          }}>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 16, color: '#1a1a1a' }}>
              Pay This Estimate
            </div>

            {/* Payment Method Selection */}
            <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
              <button
                onClick={() => handleStartPayment('card')}
                disabled={paymentLoading}
                style={{
                  flex: 1, padding: '16px 20px', borderRadius: 12, cursor: 'pointer',
                  border: '2px solid oklch(0.55 0.15 270 / 0.4)', background: 'oklch(0.55 0.15 270 / 0.06)',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
                  transition: 'all 0.15s ease',
                }}
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="oklch(0.55 0.15 270)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
                  <line x1="1" y1="10" x2="23" y2="10" />
                </svg>
                <span style={{ fontSize: 14, fontWeight: 600, color: '#1a1a1a' }}>Pay with Card</span>
                <span style={{ fontSize: 11, color: '#888' }}>
                  Fee: 2.9% + $0.25 (${(calculateFee(totalCents, 'card') / 100).toFixed(2)})
                </span>
              </button>

              <button
                onClick={() => handleStartPayment('ach')}
                disabled={paymentLoading}
                style={{
                  flex: 1, padding: '16px 20px', borderRadius: 12, cursor: 'pointer',
                  border: '2px solid oklch(0.75 0.18 145 / 0.4)', background: 'oklch(0.75 0.18 145 / 0.06)',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
                  transition: 'all 0.15s ease',
                }}
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="oklch(0.75 0.18 145)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" />
                  <path d="M3 5v14a2 2 0 0 0 2 2h16v-5" />
                  <path d="M18 12a2 2 0 0 0 0 4h4v-4Z" />
                </svg>
                <span style={{ fontSize: 14, fontWeight: 600, color: '#1a1a1a' }}>Pay with Bank</span>
                <span style={{ fontSize: 11, color: '#888' }}>
                  Fee: 0.8% capped at $25 (${(calculateFee(totalCents, 'ach') / 100).toFixed(2)})
                </span>
              </button>
            </div>

            {paymentLoading && (
              <div style={{ textAlign: 'center', color: '#888', fontSize: 13, padding: 16 }}>
                Preparing payment...
              </div>
            )}

            {paymentError && (
              <div style={{ color: '#dc2626', fontSize: 13, padding: '8px 12px', borderRadius: 8, background: '#fef2f2', marginTop: 8 }}>
                {paymentError}
              </div>
            )}
          </div>
        )}

        {/* Stripe Payment Form */}
        {showPayment && paymentClientSecret && (
          <div style={{ padding: 24, borderTop: '1px solid oklch(0.85 0.02 260)', marginTop: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#1a1a1a' }}>
                {paymentMethod === 'card' ? 'Card Payment' : 'Bank Transfer'}
              </div>
              <button onClick={() => { setShowPayment(false); setPaymentClientSecret(null); }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#888', fontSize: 13 }}>
                Cancel
              </button>
            </div>

            {/* Amount Summary */}
            {paymentFeeInfo && (
              <div style={{
                padding: 16, borderRadius: 10, background: '#f8fafc', border: '1px solid #e2e8f0',
                marginBottom: 20, fontSize: 13,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ color: '#666' }}>Estimate Total</span>
                  <span style={{ fontWeight: 600 }}>${(paymentFeeInfo.amount / 100).toFixed(2)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ color: '#666' }}>Processing Fee</span>
                  <span style={{ color: '#888' }}>${(paymentFeeInfo.fee / 100).toFixed(2)}</span>
                </div>
                <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: 6, display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontWeight: 700 }}>You Pay</span>
                  <span style={{ fontWeight: 700, fontSize: 15 }}>${(paymentFeeInfo.amount / 100).toFixed(2)}</span>
                </div>
              </div>
            )}

            <Elements
              stripe={stripePromise}
              options={{
                clientSecret: paymentClientSecret,
                appearance: {
                  theme: 'stripe',
                  variables: {
                    colorPrimary: '#6366f1',
                    borderRadius: '10px',
                    fontFamily: 'system-ui, -apple-system, sans-serif',
                  },
                },
              }}
            >
              <CheckoutForm
                onSuccess={handlePaymentComplete}
                onError={(msg) => setPaymentError(msg)}
                amount={paymentFeeInfo?.amount}
              />
            </Elements>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================
// Stripe Checkout Form (used inside Elements provider)
// ============================================================

function CheckoutForm({ onSuccess, onError, amount }) {
  const stripe = useStripe();
  const elements = useElements();
  const [processing, setProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!stripe || !elements) return;

    setProcessing(true);
    setErrorMsg(null);

    try {
      const { error, paymentIntent } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: window.location.href,
        },
        redirect: 'if_required',
      });

      if (error) {
        setErrorMsg(error.message);
        onError(error.message);
      } else if (paymentIntent && paymentIntent.status === 'succeeded') {
        onSuccess();
      } else if (paymentIntent && paymentIntent.status === 'processing') {
        onSuccess();
      } else {
        setErrorMsg('Payment was not completed. Please try again.');
      }
    } catch (err) {
      setErrorMsg('An unexpected error occurred.');
      onError('An unexpected error occurred.');
    }

    setProcessing(false);
  };

  return (
    <form onSubmit={handleSubmit}>
      <PaymentElement
        options={{
          layout: 'tabs',
        }}
      />

      {errorMsg && (
        <div style={{ color: '#dc2626', fontSize: 13, marginTop: 12, padding: '8px 12px', borderRadius: 8, background: '#fef2f2' }}>
          {errorMsg}
        </div>
      )}

      <button
        type="submit"
        disabled={!stripe || processing}
        style={{
          width: '100%', marginTop: 20, padding: '14px 24px',
          borderRadius: 12, border: 'none', cursor: processing ? 'wait' : 'pointer',
          background: processing ? '#9ca3af' : '#6366f1',
          color: '#fff', fontSize: 15, fontWeight: 700,
          transition: 'all 0.15s ease',
        }}
      >
        {processing ? 'Processing...' : `Pay $${amount ? (amount / 100).toFixed(2) : '0.00'}`}
      </button>
    </form>
  );
}
