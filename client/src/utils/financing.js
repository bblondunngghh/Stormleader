/**
 * Calculate monthly payment using standard amortization formula.
 * M = P * [r(1+r)^n] / [(1+r)^n - 1]
 *
 * @param {number} principal - Total amount in cents
 * @param {number} apr - Annual percentage rate (e.g. 6.99)
 * @param {number} termMonths - Loan term in months
 * @returns {number} Monthly payment in cents
 */
export function calcMonthlyPayment(principal, apr, termMonths) {
  if (termMonths <= 0) return 0;
  if (apr === 0) return Math.round(principal / termMonths);

  const r = apr / 100 / 12;
  const n = termMonths;
  const factor = Math.pow(1 + r, n);
  return Math.round(principal * (r * factor) / (factor - 1));
}

/**
 * Format cents as dollar string.
 * @param {number} cents
 * @returns {string} e.g. "$1,250.00"
 */
export function formatMoney(cents) {
  return '$' + (cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
