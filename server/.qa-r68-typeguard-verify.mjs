// Verify the type guards: 4 bad shapes -> 400, and the VALID-STRING CONTROL still -> 201.
// The control matters more than the rejections: a guard that also blocks real input is worse
// than the bug. Control rows are deleted afterwards, so net DB writes are 0.
import fs from 'fs';
import pool from './src/db/pool.js';

const BASE = 'http://localhost:3001';
const TOK = (await (await fetch(BASE + '/api/auth/login', {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'waterlooconstruction1@gmail.com',
                         password: '2Wealth&health', tenantSlug: 'waterloo' }) })).json()).accessToken;
fs.writeFileSync('C:/tmp/qa-token.txt', TOK);
const H = { Authorization: `Bearer ${TOK}`, 'Content-Type': 'application/json' };
const TENANT = (await pool.query(`SELECT id FROM tenants WHERE slug='waterloo'`)).rows[0].id;

const post = async (p, b) => {
  const r = await fetch(BASE + p, { method: 'POST', headers: H, body: JSON.stringify(b) });
  let j = null; const t = await r.text(); try { j = JSON.parse(t); } catch { j = t.slice(0, 100); }
  return { status: r.status, body: j };
};

const CASES = [
  ['/api/crm/tasks',           'title',        'tasks',              'QA r68 control task'],
  ['/api/crm/work-orders',     'title',        'work_orders',        'QA r68 control wo'],
  ['/api/estimates/templates', 'name',         'estimate_templates', 'QA r68 control tpl'],
  ['/api/crm/subcontractors',  'name',         'subcontractors',     'QA r68 control sub'],
  ['/api/crm/leads/quick',     'contact_name', 'leads',              'QA r68 control lead'],
  ['/api/crm/leads/quick',     'address',      'leads',              '123 QA r68 Control St'],
];
const BAD = [['array', [1, 2, 3]], ['object', { $eq: 1 }], ['number', 12345], ['boolean', true]];

let pass = 0, fail = 0;
const created = [];
console.log('route                       field         shape    got   expect  verdict');
console.log('--------------------------- ------------- -------- ----- ------- -------');
for (const [path, field, table, goodVal] of CASES) {
  for (const [name, val] of BAD) {
    const r = await post(path, { [field]: val });
    const ok = r.status === 400;
    ok ? pass++ : fail++;
    console.log(`${path.padEnd(27)} ${field.padEnd(13)} ${name.padEnd(8)} ${String(r.status).padStart(5)} ` +
                `${'400'.padStart(7)}  ${ok ? 'PASS' : 'FAIL <<<'}`);
    if (!ok) console.log('      body:', JSON.stringify(r.body).slice(0, 140));
  }
  // CONTROL: a real string must still be accepted.
  const c = await post(path, { [field]: goodVal });
  const cok = c.status === 201;
  cok ? pass++ : fail++;
  console.log(`${path.padEnd(27)} ${field.padEnd(13)} ${'CONTROL'.padEnd(8)} ${String(c.status).padStart(5)} ` +
              `${'201'.padStart(7)}  ${cok ? 'PASS' : 'FAIL <<<'}`);
  if (!cok) console.log('      body:', JSON.stringify(c.body).slice(0, 200));
  if (c.status === 201 && c.body && c.body.id) created.push([table, c.body.id]);
  // CONTROL 2: the missing-field guard must still fire.
  const m = await post(path, {});
  const mok = m.status === 400;
  mok ? pass++ : fail++;
  console.log(`${path.padEnd(27)} ${field.padEnd(13)} ${'EMPTY{}'.padEnd(8)} ${String(m.status).padStart(5)} ` +
              `${'400'.padStart(7)}  ${mok ? 'PASS' : 'FAIL <<<'}`);
}

console.log('\n=== cleanup of control rows (net DB writes must be 0) ===');
let del = 0;
for (const [table, id] of created) {
  const r = await pool.query(`DELETE FROM ${table} WHERE id=$1 AND tenant_id=$2`, [id, TENANT]);
  del += r.rowCount;
}
console.log(`control rows created: ${created.length}, deleted: ${del}`);
console.log(`\nTOTAL: ${pass} pass, ${fail} fail`);
await pool.end();
process.exit(fail ? 1 : 0);
