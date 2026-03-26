import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';

export default function CustomSelect({ value, onChange, options, placeholder, style, icon }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0, width: 0 });
  const ref = useRef(null);
  const btnRef = useRef(null);
  const label = options.find(o => o.value === value)?.label || placeholder || '—';

  const handleClickOutside = useCallback((e) => {
    if (ref.current && !ref.current.contains(e.target) &&
        btnRef.current && !btnRef.current.contains(e.target)) {
      setOpen(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside, true);
    }, 0);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handleClickOutside, true);
    };
  }, [open, handleClickOutside]);

  const handleToggle = () => {
    if (!open && btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      setPos({ top: rect.bottom + 4, left: rect.left, width: rect.width });
    }
    setOpen(!open);
  };

  const handleSelect = (val) => {
    onChange(val);
    setOpen(false);
  };

  const dropdown = open ? createPortal(
    <div ref={ref} style={{
      position: 'fixed', top: pos.top, left: pos.left, zIndex: 9999,
      background: 'oklch(0.18 0.02 260)', border: '1px solid oklch(0.30 0.02 260)',
      borderRadius: 12, padding: 4, minWidth: pos.width, width: 'max-content',
      boxShadow: '0 8px 24px oklch(0 0 0 / 0.5)',
      maxHeight: 260, overflowY: 'auto',
    }}>
      {options.map(o => (
        <div
          key={o.value}
          onMouseDown={(e) => { e.preventDefault(); e.nativeEvent.stopImmediatePropagation(); handleSelect(o.value); }}
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
    </div>,
    document.body
  ) : null;

  return (
    <div style={{ position: 'relative', ...style }}>
      <button
        ref={btnRef}
        type="button"
        onClick={handleToggle}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
          width: '100%', height: 36, padding: '0 16px', fontSize: 13, fontWeight: 500, boxSizing: 'border-box',
          background: 'oklch(0.22 0.02 260 / 0.45)', border: '1px solid var(--glass-border)',
          borderRadius: 12, color: value ? 'var(--text-primary)' : 'var(--text-muted)',
          cursor: 'pointer', textAlign: 'left', backdropFilter: 'blur(12px)',
        }}
      >
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 5 }}>{icon}{label}</span>
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, opacity: 0.5 }}>
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      {dropdown}
    </div>
  );
}
