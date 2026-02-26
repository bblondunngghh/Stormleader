import { useState, useEffect, useRef } from 'react';
import client from '../api/client';

export default function PublicEstimate({ token }) {
  const [estimate, setEstimate] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [signerName, setSignerName] = useState('');
  const [signing, setSigning] = useState(false);
  const [submitted, setSubmitted] = useState(false);
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

  return (
    <div className="public-estimate-page">
      <div className="public-estimate-card">
        {/* Header */}
        <div className="public-estimate-header">
          <div className="public-estimate-company">
            <div className="public-estimate-company__name">{estimate.company_name || 'StormLeads Roofing'}</div>
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
      </div>
    </div>
  );
}
