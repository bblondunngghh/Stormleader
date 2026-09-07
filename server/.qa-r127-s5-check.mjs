import pool from './src/db/pool.js';
const now = (await pool.query(
  'SELECT (SELECT count(*) FROM tasks)::int tasks,(SELECT count(*) FROM activities)::int acts,' +
  '(SELECT count(*) FROM client_status_tokens)::int toks')).rows[0];
console.log('BASELINE(s4) {"tasks":0,"acts":2,"toks":4}');
console.log('NOW       ' + JSON.stringify(now));
const ids = {
  client_status_tokens: ['283bbfdd-ac8c-4ffb-b047-6b0722524f34'],
  activities: ['8fbb611a-bc95-4332-9402-4b8f7df77d15','b99447bb-48fa-48ca-be73-ee8740aae000'],
  tasks: ['cc3973a9-3106-43c1-8bf5-04db01aa7d32'],
};
for (const [t, list] of Object.entries(ids)) {
  const r = await pool.query(`SELECT id, created_at FROM ${t} WHERE id = ANY($1)`, [list]);
  console.log(`${t}: ${r.rowCount}/${list.length} still present`);
  r.rows.forEach(x => console.log('   ', x.id, x.created_at));
}
// was the token row pre-existing (update) or new (insert)?
const tk = await pool.query(
  'SELECT id, lead_id, created_at FROM client_status_tokens ORDER BY created_at');
console.log('\nall client_status_tokens (' + tk.rowCount + '):');
tk.rows.forEach(x => console.log('   ', x.id, 'lead=' + x.lead_id, x.created_at));
console.log('\nlead dc8135aa stage now:',
  (await pool.query('SELECT stage FROM leads WHERE id=$1',['dc8135aa-b210-4f33-bbe1-ad8f0997d3dd'])).rows[0].stage,
  '(s4 recorded orig: contacted)');
console.log('lead count:', (await pool.query('SELECT count(*)::int c FROM leads')).rows[0].c);
await pool.end();
