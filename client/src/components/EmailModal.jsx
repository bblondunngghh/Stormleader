import { useState, useRef, useEffect } from 'react';
import { logActivity } from '../api/crm';
import { IconX } from './Icons';

const tones = [
  { key: 'friendly', label: 'Friendly' },
  { key: 'direct', label: 'Direct' },
  { key: 'professional', label: 'Professional' },
  { key: 'concerned', label: 'Concerned' },
  { key: 'followup', label: 'Follow-Up' },
];

function getDraft(tone, firstName, address) {
  const name = firstName || 'there';
  const street = address ? address.split(',')[0] : 'your street';

  switch (tone) {
    case 'friendly':
      return {
        subject: 'Quick question about your roof',
        body: `Hey ${name},\n\nNot sure if you heard, but there was a pretty bad storm that came through your area recently. I was actually out on ${street} the other day and noticed a few homes with some damage.\n\nFigured I'd reach out just in case — happy to swing by and take a quick look at your roof, no charge or anything. If there is damage, insurance usually covers the whole thing.\n\nEither way, no pressure at all. Just let me know if you'd want me to take a look.\n\nThanks!`,
      };
    case 'direct':
      return {
        subject: `Storm damage on ${street}`,
        body: `Hi ${name},\n\nA storm recently hit your area and I've been inspecting roofs on ${street}. Several homes nearby have damage.\n\nI'd like to take a look at yours — takes about 15 minutes and there's no cost. If there's damage, I can help you file with insurance and get it taken care of.\n\nWhat day works best for you?\n\nThanks`,
      };
    case 'professional':
      return {
        subject: `Complimentary roof inspection — ${street}`,
        body: `Hello ${name},\n\nI'm writing to let you know that recent severe weather has been reported in your area. As a local roofing contractor, I've been assessing properties nearby and wanted to offer you a complimentary roof inspection.\n\nStorm damage isn't always visible from the ground, and catching it early can prevent more costly issues down the road. If repairs are needed, most homeowner's insurance policies cover storm-related damage.\n\nPlease feel free to reach out if you'd like to schedule a time that works for you.\n\nBest regards`,
      };
    case 'concerned':
      return {
        subject: `Checking in after the storm`,
        body: `Hey ${name},\n\nJust wanted to check in — that storm the other day was no joke. I've been out in the neighborhood and a lot of homes took some hits.\n\nI know dealing with roof stuff isn't fun, but if you want I can come by and just make sure everything looks okay. Won't cost you anything and it only takes a few minutes. Better to catch something early than deal with a leak later.\n\nHope everything's good on your end. Let me know if I can help.\n\nTake care`,
      };
    case 'followup':
      return {
        subject: `Following up — roof inspection`,
        body: `Hey ${name},\n\nJust circling back on this — wanted to see if you had any interest in getting your roof looked at. I'm going to be in the area this week so it'd be easy to stop by.\n\nTotally understand if you're all set, just didn't want you to miss out in case there is something going on up there. Insurance claims have a window on them so sooner is usually better.\n\nLet me know either way!\n\nThanks`,
      };
    default:
      return { subject: '', body: '' };
  }
}

export default function EmailModal({ leadId, lead, onSave, onClose }) {
  const contactEmail = lead?.contact_email || lead?.email || '';
  const contactName = lead?.contact_name || lead?.name || '';
  const address = lead?.address || lead?.address_line1 || '';
  const rawFirst = contactName ? contactName.split(' ')[0] : '';
  const firstName = rawFirst ? rawFirst.charAt(0).toUpperCase() + rawFirst.slice(1).toLowerCase() : '';

  const [tone, setTone] = useState('friendly');
  const [to, setTo] = useState(contactEmail);

  const initial = getDraft('friendly', firstName, address);
  const [subject, setSubject] = useState(initial.subject);
  const [body, setBody] = useState(initial.body);
  const [sending, setSending] = useState(false);

  const handleToneChange = (newTone) => {
    setTone(newTone);
    const draft = getDraft(newTone, firstName, address);
    setSubject(draft.subject);
    setBody(draft.body);
  };

  const handleSend = async () => {
    if (!to.trim()) return;
    setSending(true);
    try {
      await logActivity({
        lead_id: leadId,
        type: 'email',
        subject: `Email: ${subject}`,
        notes: `To: ${to}\nSubject: ${subject}\n\n${body}`,
        outcome: 'Sent',
        metadata: { direction: 'outbound', email_to: to, email_subject: subject },
      });
      onSave?.();
    } catch {
      // silent
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <div style={{
        position: 'fixed', inset: 0, zIndex: 200,
        background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
      }} onClick={onClose} />
      <div style={{
        position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
        zIndex: 201, width: '90vw', maxWidth: 580,
        background: 'oklch(0.14 0.02 260)', border: '1px solid oklch(0.25 0.02 260)',
        borderRadius: 12, boxShadow: '0 20px 60px rgba(0,0,0,0.6)',
        display: 'flex', flexDirection: 'column', maxHeight: '92vh',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '16px 20px', borderBottom: '1px solid oklch(0.25 0.02 260)',
        }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>Compose Email</span>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--text-muted)', fontSize: 18, lineHeight: 1, padding: '0 4px',
          }}>
            <IconX />
          </button>
        </div>

        {/* Form */}
        <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12, overflowY: 'auto' }}>
          {/* Tone Selector */}
          <ToneDropdown tone={tone} onChange={handleToneChange} />

          {/* To */}
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: 4 }}>To</label>
            <input
              className="form-input"
              type="email"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              placeholder="recipient@email.com"
              style={{ width: '100%' }}
            />
          </div>

          {/* Subject */}
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: 4 }}>Subject</label>
            <input
              className="form-input"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Email subject"
              style={{ width: '100%' }}
            />
          </div>

          {/* Body */}
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: 4 }}>Message</label>
            <textarea
              className="form-input"
              rows={10}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              style={{ width: '100%', resize: 'none', lineHeight: 1.6 }}
            />
          </div>
        </div>

        {/* Footer */}
        <div style={{
          display: 'flex', gap: 'var(--space-sm)', justifyContent: 'flex-end',
          padding: '12px 20px', borderTop: '1px solid oklch(0.25 0.02 260)',
        }}>
          <button onClick={onClose} style={{
            padding: '8px 16px', fontSize: 12, fontWeight: 600,
            background: 'oklch(0.22 0.02 260)', color: 'var(--text-secondary)',
            border: '1px solid var(--glass-border)', borderRadius: 'var(--radius-sm)',
            cursor: 'pointer',
          }}>Cancel</button>
          <button
            onClick={handleSend}
            disabled={!to.trim() || sending}
            style={{
              padding: '8px 20px', fontSize: 12, fontWeight: 700,
              background: 'var(--accent-blue)', color: 'white',
              border: 'none', borderRadius: 'var(--radius-sm)',
              cursor: (!to.trim() || sending) ? 'not-allowed' : 'pointer',
              opacity: (!to.trim() || sending) ? 0.5 : 1,
            }}
          >{sending ? 'Sending...' : 'Send Email'}</button>
        </div>
      </div>
    </>
  );
}

function ToneDropdown({ tone, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handleClick = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  const selected = tones.find(t => t.key === tone);

  return (
    <div ref={ref}>
      <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: 4 }}>Tone</label>
      <div style={{ position: 'relative' }}>
        <button
          onClick={() => setOpen(!open)}
          style={{
            width: '100%', height: 36, padding: '0 32px 0 var(--space-lg)',
            borderRadius: 'var(--radius-md)', border: '1px solid var(--glass-border)',
            background: 'oklch(0.14 0.02 260 / 0.6)', backdropFilter: 'blur(12px)',
            color: 'var(--text-primary)', fontSize: 13, textAlign: 'left',
            cursor: 'pointer', display: 'flex', alignItems: 'center',
            transition: 'all 0.2s var(--ease-out)',
          }}
        >
          {selected?.label || 'Select tone'}
          <svg style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)' }} width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#999" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>
        {open && (
          <div style={{
            position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4, zIndex: 50,
            background: 'oklch(0.18 0.02 260)', border: '1px solid oklch(0.30 0.02 260)',
            borderRadius: 8, padding: 4,
            boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
          }}>
            {tones.map(t => (
              <button
                key={t.key}
                onClick={() => { onChange(t.key); setOpen(false); }}
                style={{
                  display: 'block', width: '100%', textAlign: 'left', padding: '7px 12px',
                  fontSize: 13, fontWeight: 500, border: 'none', borderRadius: 6, cursor: 'pointer',
                  background: t.key === tone ? 'oklch(0.25 0.03 260)' : 'transparent',
                  color: t.key === tone ? 'var(--accent-blue)' : 'var(--text-secondary)',
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'oklch(0.25 0.03 260)'}
                onMouseLeave={e => e.currentTarget.style.background = t.key === tone ? 'oklch(0.25 0.03 260)' : 'transparent'}
              >
                {t.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
