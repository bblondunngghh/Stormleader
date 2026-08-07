import pool from './src/db/pool.js';
const q = async (label, sql) => {
  try { const { rows } = await pool.query(sql); console.log(label, JSON.stringify(rows).slice(0,500)); }
  catch (e) { console.log(label, 'ERR', e.message); }
};
await q('lenders      :', 'SELECT count(*)::int n FROM financing_lenders');
await q('plans        :', 'SELECT count(*)::int n, count(*) FILTER (WHERE is_active)::int active FROM financing_plans');
await q('applications :', 'SELECT count(*)::int n FROM financing_applications');
await q('est fin-on   :', 'SELECT count(*)::int n FROM estimates WHERE financing_enabled = true');
await q('est w/token  :', 'SELECT count(*)::int n FROM estimates WHERE public_token IS NOT NULL');
await q('plan_ids set :', "SELECT count(*)::int n FROM estimates WHERE financing_plan_ids IS NOT NULL AND financing_plan_ids::text <> '[]'");
await pool.end();
