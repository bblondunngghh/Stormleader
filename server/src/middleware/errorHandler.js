import fs from 'fs';
import logger from '../utils/logger.js';

// Postgres SQLSTATE codes we surface as 400 instead of 500 — these are caused
// by client-supplied input (bad UUID, bad number, FK to a non-existent row),
// not by a server fault.
const PG_BAD_INPUT_CODES = new Set([
  '22P02', // invalid_text_representation (e.g. "not-a-uuid" cast to uuid)
  '22008', // datetime_field_overflow
  '22003', // numeric_value_out_of_range
  '22007', // invalid_datetime_format
  // Postgres parses a time literal permissively: a token it cannot read as a
  // time component it tries to read as a TIME ZONE NAME, so an invalid time
  // raises 22023 ("time zone \"not-a-time\" not recognized") rather than 22007.
  // Only work_orders.scheduled_time_start/end are `time` columns, and both are
  // written straight from the request body (workOrderService.js:303-306, :386).
  // No server-authored SQL here can raise 22023 — every generate_series/TO_CHAR
  // call site uses a constant step.
  '22023', // invalid_parameter_value (e.g. "not-a-time" cast to time)
  '23503', // foreign_key_violation
  '23514', // check_violation (e.g. a status outside the column's allowed set)
  '2201W', // invalid_row_count_in_limit_clause (e.g. ?limit=-1)
  '2201X', // invalid_row_count_in_result_offset_clause (e.g. ?offset=-5)
  '22021', // character_not_in_repertoire (e.g. a NUL byte in a query-string filter)
  '22001', // string_data_right_truncation (input longer than the column allows)
  // An explicit `null` for a whitelisted field whose column is NOT NULL. `null` is
  // valid JSON and passes every `typeof`/Array.isArray guard, so it reaches the SET
  // clause unchanged — 13 such columns are reachable across tasks, expenses,
  // invoices, subcontractors, work_orders and contract_templates. Same family as
  // 23514/22001: the client supplied a value the column will not accept, which is a
  // 400. A server-authored INSERT that omits a NOT NULL column would also be masked
  // as a 400 here, but that tradeoff is already accepted for 23503 and 23514.
  '23502', // not_null_violation (e.g. PATCH {"title": null} on a NOT NULL column)
]);

export default function errorHandler(err, req, res, _next) {
  let status = err.status || err.statusCode || 500;
  let message = status === 500 ? 'Internal server error' : err.message;

  // Translate Postgres input/FK errors so callers receive a 400 instead of 500.
  if (status === 500 && err && typeof err.code === 'string' && PG_BAD_INPUT_CODES.has(err.code)) {
    status = 400;
    if (err.code === '23503') {
      message = 'Referenced resource does not exist or is not accessible';
    } else if (err.code === '22P02') {
      // 22P02 surfaces internal type/enum names — sanitize before returning.
      // Examples we don't want to leak: "invalid input value for enum storm_source: ..."
      //                                "invalid input syntax for type uuid: ..."
      message = 'Invalid value provided for one or more fields';
    } else if (err.code === '23514') {
      // 23514 names the relation and the constraint in its message
      // (violates check constraint "estimates_status_check") — sanitize.
      message = 'One or more values are not permitted for this record';
    } else if (err.code === '22023') {
      // 22023 echoes the rejected value back as a time zone name
      // ('time zone "not-a-time" not recognized'), which is confusing rather
      // than useful — use the same generic message as 22P02.
      message = 'Invalid value provided for one or more fields';
    } else if (err.code === '22001') {
      // 22001 surfaces the column's declared width ("character varying(20)").
      message = 'One or more values exceed the maximum allowed length';
    } else if (err.code === '23502') {
      // 23502's own message names the relation ("...of relation \"tasks\"").
      // pg exposes the column separately, and that name is already part of the
      // request the caller sent, so naming it leaks nothing and is far more useful.
      message = err.column
        ? `${err.column} is required and cannot be null`
        : 'A required field was null';
    } else {
      message = err.message || 'Invalid input';
    }
  }

  logger.error({ err, method: req.method, url: req.url }, err.message);
  if (status === 500) {
    try {
      fs.appendFileSync('api-500s.log', `[500] ${new Date().toISOString()} ${req.method} ${req.url}\n${err && err.stack ? err.stack : String(err)}\n\n`);
    } catch (_e) {
      console.error('[errorHandler fallback write failed]', _e.message);
    }
    console.error('[500]', req.method, req.url, err && err.message, err && err.code);
  }

  res.status(status).json({ error: message });
}
