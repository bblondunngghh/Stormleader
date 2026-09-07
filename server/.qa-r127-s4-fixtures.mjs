import pool from './src/db/pool.js';

const q = async (label, sql, params = []) => {
  try {
    const { rows } = await pool.query(sql, params);
    console.log(label + ': ' + JSON.stringify(rows));
  } catch (e) {
    console.log(label + ' ERR: ' + e.message);
  }
};

await q('contract tokens', "SELECT id, public_token, status, lead_id FROM contracts WHERE public_token IS NOT NULL LIMIT 4");
await q('contract cols', "SELECT column_name FROM information_schema.columns WHERE table_name='contracts' AND column_name LIKE '%token%'");
await q('lead status tokens', "SELECT id, contact_name, stage, portal_token FROM leads WHERE portal_token IS NOT NULL LIMIT 3");
await q('lead token cols', "SELECT column_name FROM information_schema.columns WHERE table_name='leads' AND (column_name LIKE '%token%' OR column_name='stage')");
await q('activities', 'SELECT id, type, subject, lead_id FROM activities');
await q('stages in use', 'SELECT stage, count(*)::int n FROM leads GROUP BY stage');
await pool.end();
