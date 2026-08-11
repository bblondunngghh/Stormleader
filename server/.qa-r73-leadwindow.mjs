import pool from './src/db/pool.js';
const T = '791bb51d-3293-4839-92e9-bd4d4f873af2';
const q = async (label, sql) => { const { rows } = await pool.query(sql, [T]); console.log(label, JSON.stringify(rows[0] ?? rows)); };
await q('now()                 ', `SELECT now() AS now, current_setting('TimeZone') AS tz, $1::uuid IS NOT NULL AS _`);
await q('created_at windows    ', `SELECT
   COUNT(*) FILTER (WHERE created_at >= now() - interval '7 days')  AS last_7d,
   COUNT(*) FILTER (WHERE created_at >= now() - interval '14 days' AND created_at < now() - interval '7 days') AS prev_7d,
   COUNT(*) FILTER (WHERE created_at >= '2026-08-02')               AS since_aug2,
   COUNT(*) FILTER (WHERE created_at >= now() - interval '30 days') AS last_30d,
   COUNT(*) AS total
 FROM leads WHERE tenant_id=$1 AND deleted_at IS NULL`);
await q('newest 6 created_at   ', `SELECT json_agg(x) AS rows FROM (
   SELECT to_char(created_at,'YYYY-MM-DD HH24:MI') AS created, stage::text, COALESCE(contact_name,'(null)') AS name
   FROM leads WHERE tenant_id=$1 AND deleted_at IS NULL ORDER BY created_at DESC LIMIT 6) x`);
await pool.end();
