// A VALID document upload returned 400 (errorHandler maps PG 22P02 -> that message),
// so the INSERT itself is rejecting one of its bound values. Find which column.
import pool from './src/db/pool.js';
const c = await pool.query(
  `SELECT column_name, data_type, udt_name, is_nullable
     FROM information_schema.columns WHERE table_name='documents' ORDER BY ordinal_position`);
console.table(c.rows);

const T = '791bb51d-3293-4839-92e9-bd4d4f873af2';
const u = await pool.query(`SELECT id FROM users WHERE tenant_id=$1 LIMIT 1`, [T]);
const l = await pool.query(`SELECT id FROM leads WHERE tenant_id=$1 LIMIT 1`, [T]);
const { randomUUID } = await import('crypto');

// Replay the exact bind list from documentService.createDocument, one variant per
// candidate culprit, so the failing parameter is isolated rather than guessed.
const variants = [
  ['tags = JS array (what the route passes)', ['qa']],
  ['tags = JSON string', JSON.stringify(['qa'])],
  ['tags = null', null],
];
for (const [label, tags] of variants) {
  const id = randomUUID();
  try {
    await pool.query('BEGIN');
    await pool.query(
      `INSERT INTO documents (id, tenant_id, lead_id, uploaded_by, type, filename, file_url, file_size, mime_type, description, tags, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,NOW())`,
      [id, T, l.rows[0].id, u.rows[0].id, 'other', 'qa.txt', '/uploads/qa.txt', 21, 'text/plain', null, tags]);
    console.log(`OK    ${label}`);
  } catch (e) {
    console.log(`ERR   ${label} -> ${e.code} ${e.message.slice(0, 120)}`);
  } finally { await pool.query('ROLLBACK'); }   // never commit: probe only
}
await pool.end();
