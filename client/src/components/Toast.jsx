import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';

let toastId = 0;
let addToastGlobal = null;

export function showToast(message, type = 'info') {
  if (addToastGlobal) addToastGlobal({ id: ++toastId, message, type });
}

const typeColors = {
  info: 'oklch(0.72 0.19 250)',
  success: 'oklch(0.75 0.18 155)',
  error: 'oklch(0.68 0.22 25)',
  warning: 'oklch(0.78 0.17 85)',
};

export default function ToastContainer() {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((toast) => {
    setToasts(prev => [...prev, toast]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== toast.id));
    }, 3000);
  }, []);

  useEffect(() => {
    addToastGlobal = addToast;
    return () => { addToastGlobal = null; };
  }, [addToast]);

  if (toasts.length === 0) return null;

  return createPortal(
    <div style={{
      position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
      zIndex: 9999, display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'center',
      pointerEvents: 'none',
    }}>
      {toasts.map(t => (
        <div
          key={t.id}
          style={{
            padding: '10px 20px',
            borderRadius: '14px / 12px',
            background: 'oklch(0.18 0.02 260 / 0.95)',
            border: `1px solid ${typeColors[t.type] || typeColors.info}`,
            backdropFilter: 'blur(16px)',
            boxShadow: `0 8px 32px oklch(0 0 0 / 0.4), 0 0 12px ${typeColors[t.type] || typeColors.info}33`,
            color: typeColors[t.type] || typeColors.info,
            fontSize: 13, fontWeight: 600,
            animation: 'toast-in 0.3s ease-out',
            pointerEvents: 'auto',
          }}
        >
          {t.message}
        </div>
      ))}
    </div>,
    document.body
  );
}
