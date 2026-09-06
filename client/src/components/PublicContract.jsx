import { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';

export default function PublicContract() {
  const { token } = useParams();
  const [contract, setContract] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [signerName, setSignerName] = useState('');
  const [signing, setSigning] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const canvasRef = useRef(null);
  const drawingRef = useRef(false);

  useEffect(() => {
    if (!token) return;
    axios.get(`/api/crm/contracts/public/${token}`)
      .then(res => setContract(res.data))
      .catch(() => setError('Contract not found or has expired.'))
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

  const handleSign = async () => {
    if (!signerName.trim()) return;
    setSigning(true);
    try {
      const signatureData = canvasRef.current.toDataURL('image/png');
      await axios.post(`/api/crm/contracts/public/${token}/sign`, {
        signerName: signerName.trim(),
        signatureData,
      });
      setSubmitted(true);
      setContract(prev => ({ ...prev, status: 'signed' }));
    } catch {
      setError('Failed to sign. Please try again.');
    } finally {
      setSigning(false);
    }
  };

  if (loading) {
    return (
      <div className="public-estimate-page">
        <div className="public-estimate-loading">Loading contract...</div>
      </div>
    );
  }

  if (error && !contract) {
    return (
      <div className="public-estimate-page">
        <div className="public-estimate-error">{error}</div>
      </div>
    );
  }

  const sections = parseSections(contract.content);
  const canSign = contract.status === 'sent' || contract.status === 'viewed';
  const isSigned = contract.status === 'signed';
  const isVoided = contract.status === 'voided';

  function parseSections(content) {
    if (!content) return [];
    if (Array.isArray(content)) return content;
    // Array.isArray, not truthiness: a row stored before the server-side guard can
    // hold `sections: "..."`, and returning it makes the sections.map() below throw
    // and white-screen the customer-facing page.
    if (typeof content === 'object' && Array.isArray(content.sections)) return content.sections;
    return [{ title: 'Agreement', body: typeof content === 'string' ? content : '' }];
  }

  // Contract rows carry the joined lead's contact_* / address columns; a customer name
  // may also have been snapshotted into the content JSONB when the contract was drafted.
  const contentObj = contract.content && typeof contract.content === 'object' && !Array.isArray(contract.content)
    ? contract.content
    : {};
  const customerName = contract.contact_name || contentObj.customer_name || contract.signer_name;
  const customerAddress = contract.address || contentObj.customer_address;
  const customerPhone = contract.contact_phone || contentObj.customer_phone;
  const customerEmail = contract.contact_email || contentObj.customer_email;

  return (
    <div className="public-estimate-page">
      <div className="public-estimate-card">
        {/* Header */}
        <div className="public-estimate-header">
          <div className="public-estimate-company">
            <div className="public-estimate-company__name">{contract.company_name || 'StormPipe Roofing'}</div>
            <div className="public-estimate-company__sub">Service Contract</div>
          </div>
          <div className="public-estimate-meta">
            <h1 className="public-estimate-meta__number">CONTRACT</h1>
            <div className="public-estimate-meta__date">
              {contract.created_at && new Date(contract.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
            </div>
          </div>
        </div>

        {/* Customer. A contract row does NOT carry customer_* columns the way an estimate
            does - getContractByToken (contractService.js:62) joins the lead and returns
            contact_name / address / contact_phone / contact_email, and the content JSONB
            is the only other place a customer name lives. Reading the estimate's idiom
            here left `customer_name` undefined, so this whole block was gated off and the
            customer never saw who the contract was prepared for. */}
        {customerName && (
          <div className="public-estimate-customer">
            <div className="public-estimate-section-title">Prepared For</div>
            <div className="public-estimate-customer__name">{customerName}</div>
            {customerAddress && <div>{customerAddress}</div>}
            {customerPhone && <div>{customerPhone}</div>}
            {customerEmail && <div>{customerEmail}</div>}
          </div>
        )}

        {/* Contract Sections */}
        {sections.map((section, idx) => (
          <div key={idx} className="public-estimate-section">
            {section.title && (
              <div className="public-estimate-section-title">{section.title}</div>
            )}
            {section.body && (
              <p style={{ whiteSpace: 'pre-wrap', lineHeight: 1.7 }}>{section.body}</p>
            )}
          </div>
        ))}

        {/* Voided */}
        {isVoided && (
          <div className="public-estimate-status public-estimate-status--declined">
            This contract has been voided.
          </div>
        )}

        {/* Signed confirmation */}
        {(isSigned || submitted) && (
          <div className="public-estimate-status public-estimate-status--accepted">
            Contract Signed
            {contract.signed_at && (
              <span> on {new Date(contract.signed_at).toLocaleDateString()}</span>
            )}
            {contract.signer_name && (
              <span> by {contract.signer_name}</span>
            )}
            {contract.signature_data && (
              <div style={{ marginTop: 12 }}>
                <img src={contract.signature_data} alt="Signature" style={{ maxWidth: 200, height: 'auto' }} />
              </div>
            )}
          </div>
        )}

        {/* Sign Section */}
        {canSign && !submitted && (
          <div className="public-estimate-actions">
            <div className="public-estimate-section-title">Sign This Contract</div>

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

            <button
              onClick={handleSign}
              disabled={!signerName.trim() || signing}
              className="public-estimate-btn public-estimate-btn--accept"
            >
              {signing ? 'Signing...' : 'Sign Contract'}
            </button>

            {error && <div style={{ color: '#dc2626', fontSize: 13, marginTop: 8 }}>{error}</div>}
          </div>
        )}
      </div>
    </div>
  );
}
