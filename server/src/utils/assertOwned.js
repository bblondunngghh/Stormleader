import pool from '../db/pool.js';

/**
 * Reject a client-supplied foreign key that points at a row owned by another tenant.
 *
 * Every create/update route that takes an id from the request body — lead_id,
 * estimate_id, assigned_to — trusted it, so a caller could attach one tenant's row to
 * another tenant's record. Scoping the READ joins (3a3d752, 1e94206) stopped that
 * dangling reference from disclosing the foreign row's PII, but the reference could
 * still be stored. This closes the write side.
 *
 * Absent values pass: these columns are all nullable and the callers coerce '' to null.
 * A malformed uuid raises 22P02, which errorHandler.js maps to a 400.
 */
export async function assertOwned(tenantId, table, id, label) {
  if (id === undefined || id === null || id === '') return;
  const { rows } = await pool.query(
    `SELECT 1 FROM ${table} WHERE id = $1 AND tenant_id = $2`,
    [id, tenantId]
  );
  if (rows.length === 0) {
    const err = new Error(`${label} not found`);
    err.status = 400;
    throw err;
  }
}

export default assertOwned;
