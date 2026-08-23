// Run 88 — DB hygiene check for rows the probes may have left behind.
import pool from './src/db/pool.js';

const q = async (label, sql, params = []) => {
  const { rows } = await pool.query(sql, params);
  console.log(label, JSON.stringify(rows));
};

await q('leftover QA-R88 contacts:', `SELECT id, lead_id, first_name, last_name, email FROM contacts WHERE first_name = 'QA-R88' OR email = 'qa-r88@example.invalid'`);
await q('total contacts:', 'SELECT count(*)::int AS n FROM contacts');
await pool.end();
