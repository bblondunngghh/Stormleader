import pool from './src/db/pool.js';
import { normalizeTaskPriority } from './src/utils/taskPriority.js';

const TENANT = (await pool.query(`SELECT id FROM tenants WHERE slug='waterloo'`)).rows[0].id;
const out = [];

// 1. enum members straight from the catalog
const enumRows = await pool.query(
  `SELECT e.enumlabel FROM pg_enum e JOIN pg_type t ON t.oid=e.enumtypid
   WHERE t.typname='lead_priority' ORDER BY e.enumsortorder`);
out.push(['lead_priority enum members', enumRows.rows.map(r => r.enumlabel).join('|')]);

// 2. what the column actually is
const col = await pool.query(
  `SELECT udt_name FROM information_schema.columns
   WHERE table_name='tasks' AND column_name='priority'`);
out.push(['tasks.priority udt', col.rows[0]?.udt_name]);

// 3. normalizer mapping for every value AutomationSettings.jsx offers + the old default
const vocab = ['low','medium','high','urgent',undefined,null,'hot','warm','cold','bogus'];
for (const v of vocab) out.push([`normalize(${JSON.stringify(v)})`, normalizeTaskPriority(v)]);

// 4. prove the INSERT: raw legacy value vs normalized value, both rolled back
const c = await pool.connect();
for (const [label, val] of [['RAW medium', 'medium'], ['NORMALIZED medium', normalizeTaskPriority('medium')]]) {
  try {
    await c.query('BEGIN');
    await c.query(
      `INSERT INTO tasks (tenant_id, lead_id, title, priority, due_date) VALUES ($1,$2,$3,$4,$5)`,
      [TENANT, null, 'QA-R108 rollback probe', val, null]);
    out.push([`INSERT ${label}`, 'ACCEPTED']);
  } catch (e) {
    out.push([`INSERT ${label}`, `${e.code} ${e.message.slice(0, 70)}`]);
  } finally {
    await c.query('ROLLBACK');
  }
}
c.release();

// 5. confirm nothing was written
const n = await pool.query(`SELECT count(*)::int c FROM tasks WHERE title LIKE 'QA-R108%'`);
out.push(['rows left behind', n.rows[0].c]);

for (const [k, v] of out) console.log(String(k).padEnd(34), v);
await pool.end();
