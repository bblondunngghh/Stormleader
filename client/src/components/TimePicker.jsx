import { useState, useEffect, useRef } from 'react';

export default function TimePicker({ value, onChange, placeholder }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // Generate time options in 30-minute intervals
  const timeOptions = [];
  for (let h = 0; h < 24; h++) {
    for (let m = 0; m < 60; m += 30) {
      const hh = String(h).padStart(2, '0');
      const mm = String(m).padStart(2, '0');
      const val24 = `${hh}:${mm}`;
      const hour12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
      const ampm = h < 12 ? 'AM' : 'PM';
      const label = `${hour12}:${mm} ${ampm}`;
      timeOptions.push({ value: val24, label });
    }
  }

  const displayValue = value
    ? timeOptions.find(o => o.value === value)?.label || value
    : '';

  const selectTime = (val) => {
    onChange(val);
    setOpen(false);
  };

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
          width: '100%', height: 36, padding: '0 16px', fontSize: 13, fontWeight: 500, boxSizing: 'border-box',
          background: 'oklch(0.22 0.02 260 / 0.45)', border: '1px solid var(--glass-border)',
          borderRadius: 12, color: displayValue ? 'var(--text-primary)' : 'var(--text-muted)',
          cursor: 'pointer', textAlign: 'left', backdropFilter: 'blur(12px)',
        }}
      >
        <span>{displayValue || placeholder || 'Select time'}</span>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, opacity: 0.5 }}>
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
        </svg>
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, marginTop: 4, zIndex: 200,
          background: 'oklch(0.18 0.02 260)', border: '1px solid oklch(0.30 0.02 260)',
          borderRadius: 12, padding: 4, minWidth: '100%', width: 'max-content',
          boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
          maxHeight: 240, overflowY: 'auto',
        }}>
          {timeOptions.map(o => (
            <div
              key={o.value}
              onMouseDown={(e) => { e.preventDefault(); e.nativeEvent.stopImmediatePropagation(); selectTime(o.value); }}
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
