/**
 * `trigger_config` and `action_config` are jsonb OBJECT columns: every consumer
 * reads named properties off them (`matchesConditions`, `executeAction`).
 *
 * A named-property read on a scalar yields `undefined` rather than throwing, so
 * a string/number/boolean/array stored in one of these columns is accepted in
 * silence — and then makes every condition check fall through to `return true`,
 * firing the automation on EVERY event of its trigger type instead of the
 * configured subset.
 *
 * `|| {}` does not catch this: it only guards FALSY values.
 */
export function isPlainObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export default isPlainObject;
