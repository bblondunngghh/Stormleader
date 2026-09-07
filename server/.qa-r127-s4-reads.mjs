// Closes the two read-path joins from 83ba6b4 that the main harness could not reach:
// documents (/api/documents) and drip enrollments. Both tables are empty in this dataset,
// so each needs a planted row; every one is removed in the finally block.
import pool from './src/db/pool.js';

const BASE = 'http://localhost:3001/api';
const MINE = '791bb51d-3293-4839-92e9-bd4d4f873af2';
const OTHER = 'dbeb300e-414f-4dac-9aeb-d8adf8d9ca34';
const PII_NAME = 'ZZQA-FOREIGN-NAME';
const PII_ADDR = '999 ZZQA Leak Street';
const PII_EMAIL = 'zzqa-foreign@example.invalid';

const lr = await fetch(BASE + '/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'waterlooconstruction1@gmail.com',
    password: '2Wealth&health',
    tenantSlug: 'waterloo',
  }),
});
const lj = await lr.json();
if (!lj.accessToken) { console.log('LOGIN FAILED ' + lr.status); process.exit(1); }
const H = { 'Content-Type': 'application/json', Authorization: `Bearer ${lj.accessToken}` };

const counts = async () => (await pool.query(
  'SELECT (SELECT count(*) FROM leads)::int leads,(SELECT count(*) FROM documents)::int docs,' +
  '(SELECT count(*) FROM drip_sequences)::int seqs,(SELECT count(*) FROM drip_enrollments)::int enr')).rows[0];

const before = await counts();
console.log('BASELINE ' + JSON.stringify(before));
const ids = {};
let fails = 0;

try {
  ids.lead = (await pool.query(
    'INSERT INTO leads (tenant_id, contact_name, address, contact_email) VALUES ($1,$2,$3,$4) RETURNING id',
    [OTHER, PII_NAME, PII_ADDR, PII_EMAIL])).rows[0].id;

  // documents: row owned by MY tenant, lead_id pointing at the foreign lead
  ids.doc = (await pool.query(
    'INSERT INTO documents (tenant_id, lead_id, filename, file_url, type) ' +
    "VALUES ($1,$2,'QA-R127-S4.pdf','https://example.invalid/qa.pdf','other') RETURNING id",
    [MINE, ids.lead])).rows[0].id;

  ids.seq = (await pool.query(
    'INSERT INTO drip_sequences (tenant_id, name, trigger_type) ' +
    "VALUES ($1,'QA-R127-S4-SEQ','manual') RETURNING id", [MINE])).rows[0].id;
  ids.enr = (await pool.query(
    'INSERT INTO drip_enrollments (tenant_id, sequence_id, lead_id) VALUES ($1,$2,$3) RETURNING id',
    [MINE, ids.seq, ids.lead])).rows[0].id;
  console.log('planted foreign lead + document + drip enrollment');

  const probes = [
    ['documents (listDocuments)', '/documents'],
    ['drip enrollments (getEnrollments)', '/crm/drip-sequences/' + ids.seq + '/enrollments'],
  ];
  for (const [name, path] of probes) {
    const r = await fetch(BASE + path, { headers: H });
    const t = await r.text();
    const leaked = t.includes(PII_NAME) || t.includes(PII_ADDR) || t.includes(PII_EMAIL);
    const pass = r.status < 400 && !leaked;
    if (!pass) fails++;
    console.log((pass ? 'PASS' : 'FAIL') + ' [C] ' + name + ' :: ' + r.status +
      ' leaked=' + leaked + ' body=' + t.slice(0, 140));
  }
} finally {
  for (const [k, table] of [['enr', 'drip_enrollments'], ['seq', 'drip_sequences'], ['doc', 'documents']]) {
    if (ids[k]) await pool.query('DELETE FROM ' + table + ' WHERE id = $1', [ids[k]]);
  }
  if (ids.lead) await pool.query('DELETE FROM leads WHERE id = $1', [ids.lead]);
  const after = await counts();
  console.log('AFTER    ' + JSON.stringify(after));
  console.log(JSON.stringify(before) === JSON.stringify(after) ? 'DB NET ZERO: yes' : 'DB NET ZERO: NO');
  console.log(fails ? fails + ' FAILURE(S)' : 'all read paths clean');
  await pool.end();
}
