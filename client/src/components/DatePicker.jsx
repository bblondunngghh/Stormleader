import { useState, useEffect, useRef } from 'react';

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const DAYS = ['Su','Mo','Tu','We','Th','Fr','Sa'];

export default function DatePicker({ value, onChange, placeholder }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  // Parse value (YYYY-MM-DD string) into viewing month/year
  const parsed = value ? new Date(value + 'T00:00:00') : null;
  const [viewYear, setViewYear] = useState(parsed?.getFullYear() || new Date().getFullYear());
  const [viewMonth, setViewMonth] = useState(parsed?.getMonth() ?? new Date().getMonth());

  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  useEffect(() => {
    if (value) {
      const d = new Date(value + 'T00:00:00');
      setViewYear(d.getFullYear());
      setViewMonth(d.getMonth());
    }
  }, [value]);

  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
    else setViewMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
    else setViewMonth(m => m + 1);
  };

  const firstDay = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const selectDay = (day) => {
    const mm = String(viewMonth + 1).padStart(2, '0');
    const dd = String(day).padStart(2, '0');
    onChange(`${viewYear}-${mm}-${dd}`);
    setOpen(false);
  };

  const selectedDay = parsed && parsed.getFullYear() === viewYear && parsed.getMonth() === viewMonth ? parsed.getDate() : null;
  const today = new Date();
  const todayDay = today.getFullYear() === viewYear && today.getMonth() === viewMonth ? today.getDate() : null;

  const displayValue = parsed
    ? `${parsed.getMonth() + 1}/${parsed.getDate()}/${parsed.getFullYear()}`
    : '';

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
          width: '100%', height: 36, padding: '0 16px', fontSize: 13, fontWeight: 500, boxSizing: 'border-box',
          background: 'oklch(0.14 0.02 260 / 0.6)', border: '1px solid var(--glass-border)',
          borderRadius: 'var(--radius-md)', color: displayValue ? 'var(--text-primary)' : 'var(--text-muted)',
          cursor: 'pointer', textAlign: 'left', backdropFilter: 'blur(12px)',
        }}
      >
        <span>{displayValue || placeholder || 'Select date'}</span>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, opacity: 0.5 }}>
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
          <line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
        </svg>
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, marginTop: 4, zIndex: 100,
          background: 'oklch(0.18 0.02 260)', border: '1px solid oklch(0.30 0.02 260)',
          borderRadius: 10, padding: 12, width: 280,
          boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
        }}>
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <button type="button" onClick={prevMonth} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '4px 8px', fontSize: 16 }}>‹</button>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{MONTHS[viewMonth]} {viewYear}</span>
            <button type="button" onClick={nextMonth} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '4px 8px', fontSize: 16 }}>›</button>
          </div>

          {/* Day headers */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2, marginBottom: 4 }}>
            {DAYS.map(d => (
              <div key={d} style={{ textAlign: 'center', fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', padding: '4px 0', textTransform: 'uppercase' }}>{d}</div>
            ))}
          </div>

          {/* Days grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2 }}>
            {cells.map((day, i) => (
              <div
                key={i}
                onClick={day ? () => selectDay(day) : undefined}
                style={{
                  textAlign: 'center', padding: '6px 0', fontSize: 12, borderRadius: 6,
                  cursor: day ? 'pointer' : 'default',
                  color: day === selectedDay ? '#fff' : day === todayDay ? 'var(--accent-blue)' : day ? 'var(--text-secondary)' : 'transparent',
                  background: day === selectedDay ? 'var(--accent-blue)' : 'transparent',
                  fontWeight: day === selectedDay || day === todayDay ? 700 : 400,
                }}
                onMouseEnter={e => { if (day && day !== selectedDay) e.currentTarget.style.background = 'oklch(0.22 0.02 260)'; }}
                onMouseLeave={e => { if (day && day !== selectedDay) e.currentTarget.style.background = 'transparent'; }}
              >
                {day || ''}
              </div>
            ))}
          </div>

          {/* Clear */}
          {value && (
            <button
              type="button"
              onClick={() => { onChange(''); setOpen(false); }}
              style={{ marginTop: 8, width: '100%', padding: '6px', fontSize: 11, color: 'var(--text-muted)', background: 'none', border: '1px solid var(--glass-border)', borderRadius: 6, cursor: 'pointer' }}
            >
              Clear date
            </button>
          )}
        </div>
      )}
    </div>
  );
}
