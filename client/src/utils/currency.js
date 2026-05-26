/**
 * Format a dollar value (not cents) for display.
 *
 * - Always 2 decimals, comma-separated thousands.
 * - Negative values render as "-$1,234.56" (not "$-1,234.56").
 * - null / undefined / NaN render as "$0.00".
 *
 * For cents-stored values (financing plans, admin payouts), use formatMoney from utils/financing.js instead.
 *
 * @param {number|string|null|undefined} value
 * @returns {string}
 */
export function formatCurrency(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '$0.00';
  const sign = n < 0 ? '-' : '';
  const abs = Math.abs(n);
  return sign + '$' + abs.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
