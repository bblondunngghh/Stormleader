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
  '23503', // foreign_key_violation
  '23514', // check_violation (e.g. a status outside the column's allowed set)
  '2201W', // invalid_row_count_in_limit_clause (e.g. ?limit=-1)
  '2201X', // invalid_row_count_in_result_offset_clause (e.g. ?offset=-5)
  '22021', // character_not_in_repertoire (e.g. a NUL byte in a query-string filter)
  '22001', // string_data_right_truncation (input longer than the column allows)
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
    } else if (err.code === '22001') {
      // 22001 surfaces the column's declared width ("character varying(20)").
      message = 'One or more values exceed the maximum allowed length';
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
