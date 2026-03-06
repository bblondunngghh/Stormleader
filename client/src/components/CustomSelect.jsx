import { useState, useEffect, useRef } from 'react';

export default function CustomSelect({ value, onChange, options, placeholder, style }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const label = options.find(o => o.value === value)?.label || placeholder || '—';

  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div ref={ref} style={{ position: 'relative', ...style }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
          width: '100%', height: 36, padding: '0 16px', fontSize: 13, fontWeight: 500, boxSizing: 'border-box',
          background: 'oklch(0.14 0.02 260 / 0.6)', border: '1px solid var(--glass-border)',
          borderRadius: 8, color: value ? 'var(--text-primary)' : 'var(--text-muted)',
          cursor: 'pointer', textAlign: 'left', backdropFilter: 'blur(12px)',
        }}
      >
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, opacity: 0.5 }}>
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      {open && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, marginTop: 4, zIndex: 100,
          background: 'oklch(0.18 0.02 260)', border: '1px solid oklch(0.30 0.02 260)',
          borderRadius: 8, padding: 4, minWidth: '100%', width: 'max-content',
          boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
          maxHeight: 260, overflowY: 'auto',
        }}>
          {options.map(o => (
            <div
              key={o.value}
              onClick={() => { onChange(o.value); setOpen(false); }}
              style={{
                padding: '7px 12px', fontSize: 12, borderRadius: 6, cursor: 'pointer',
                color: o.value === value ? 'var(--accent-blue)' : 'var(--text-secondary)',
                fontWeight: o.value === value ? 600 : 400,
                background: o.value === value ? 'oklch(0.22 0.04 250 / 0.3)' : 'transparent',
              }}
              onMouseEnter={e => { if (o.value !== value) e.currentTarget.style.background = 'oklch(0.22 0.02 260)'; }}
              onMouseLeave={e => { if (o.value !== value) e.currentTarget.style.background = 'transparent'; }}
            >
              {o.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
