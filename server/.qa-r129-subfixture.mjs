// Run 129 (s1) — foreign-tenant fixture for the subcontractor assign/read path.
// Plants ONE subcontractor row in a non-caller tenant, attaches it via the API as
// `waterloo`, reads it back, then removes every row it created. Net zero.
import pool from './src/db/pool.js';
import fs from 'fs';

const API = 'http://localhost:3001/api';
const TOKEN = fs.readFileSync('C:/tmp/qa-token.txt', 'utf8').trim();
const CALLER = '791bb51d-3293-4839-92e9-bd4d4f873af2'; // waterloo (token tenant)
const FOREIGN = 'dbeb300e-414f-4dac-9aeb-d8adf8d9ca34'; // waterloo-roofco-2

const H = { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' };
const j = async (r) => { const t = await r.text(); try { return JSON.parse(t); } catch { return t; } };

const result = { steps: [] };
let subId = null;
let assigned = false;
let woId = null;
let ownAssignment = null;

try {
  const { rows: wos } = await pool.query('SELECT id FROM work_orders WHERE tenant_id = $1 LIMIT 1', [CALLER]);
  if (!wos.length) throw new Error('no work order for caller tenant');
  woId = wos[0].id;

  const { rows: [sub] } = await pool.query(
    `INSERT INTO subcontractors (tenant_id, name, company, phone, email, specialty)
     VALUES ($1,'ZZ-VICTIM-SUB','Rival Roofing LLC','555-000-9999','victim@rival.example','roofing')
     RETURNING id`,
    [FOREIGN]
  );
  subId = sub.id;
  result.steps.push({ step: 'plant', subId, woId });

  const assignRes = await fetch(`${API}/crm/subcontractors/assign`, {
    method: 'POST', headers: H,
    body: JSON.stringify({ work_order_id: woId, subcontractor_id: subId, role: 'qa-probe' }),
  });
  const assignBody = await j(assignRes);
  assigned = assignRes.status === 201;
  result.steps.push({ step: 'POST /crm/subcontractors/assign (foreign sub)', status: assignRes.status, body: assignBody });

  const readRes = await fetch(`${API}/crm/subcontractors/work-order/${woId}`, { headers: H });
  const readBody = await j(readRes);
  const leaked = JSON.stringify(readBody).includes('ZZ-VICTIM-SUB');
  result.steps.push({
    step: `GET /crm/subcontractors/work-order/${woId}`,
    status: readRes.status,
    rows: Array.isArray(readBody) ? readBody.length : null,
    LEAKED_FOREIGN_PII: leaked,
    body: readBody,
  });

  // does the caller's own list endpoint hide it? (control)
  const listRes = await fetch(`${API}/crm/subcontractors`, { headers: H });
  const listBody = await j(listRes);
  result.steps.push({
    step: 'GET /crm/subcontractors (control)',
    status: listRes.status,
    leaked: JSON.stringify(listBody).includes('ZZ-VICTIM-SUB'),
  });

  // POSITIVE PATH — the caller's OWN subcontractor must still assign and read back.
  const { rows: [mine] } = await pool.query(
    `SELECT id, name FROM subcontractors
     WHERE tenant_id = $1
       AND id NOT IN (SELECT subcontractor_id FROM work_order_subcontractors)
     LIMIT 1`,
    [CALLER]
  );
  const okRes = await fetch(`${API}/crm/subcontractors/assign`, {
    method: 'POST', headers: H,
    body: JSON.stringify({ work_order_id: woId, subcontractor_id: mine.id, role: 'qa-probe-positive' }),
  });
  const okBody = await j(okRes);
  const okRead = await j(await fetch(`${API}/crm/subcontractors/work-order/${woId}`, { headers: H }));
  result.steps.push({
    step: 'POSITIVE: assign own subcontractor + read back',
    assignStatus: okRes.status,
    ownSub: mine.name,
    readRows: Array.isArray(okRead) ? okRead.length : null,
    ownNameResolved: JSON.stringify(okRead).includes(mine.name),
  });
  ownAssignment = okBody && okBody.id ? { wo: woId, sub: mine.id } : null;

  // 404 shape check for a subcontractor id that exists nowhere
  const ghost = await fetch(`${API}/crm/subcontractors/assign`, {
    method: 'POST', headers: H,
    body: JSON.stringify({ work_order_id: woId, subcontractor_id: '00000000-0000-0000-0000-000000000000' }),
  });
  result.steps.push({ step: 'nonexistent subcontractor_id', status: ghost.status, body: await j(ghost) });
} catch (e) {
  result.error = String(e);
} finally {
  if (subId) {
    const d1 = await pool.query('DELETE FROM work_order_subcontractors WHERE subcontractor_id = $1', [subId]);
    const d2 = await pool.query('DELETE FROM subcontractors WHERE id = $1', [subId]);
    result.cleanup = { assignmentsRemoved: d1.rowCount, subsRemoved: d2.rowCount };
  }
  if (ownAssignment) {
    const d3 = await pool.query(
      'DELETE FROM work_order_subcontractors WHERE work_order_id = $1 AND subcontractor_id = $2 AND role = $3',
      [ownAssignment.wo, ownAssignment.sub, 'qa-probe-positive']
    );
    result.cleanup = { ...(result.cleanup || {}), positiveAssignmentsRemoved: d3.rowCount };
  }
  const { rows: [c] } = await pool.query('SELECT count(*)::int n FROM subcontractors');
  const { rows: [c2] } = await pool.query('SELECT count(*)::int n FROM work_order_subcontractors');
  result.finalCounts = { subcontractors: c.n, work_order_subcontractors: c2.n };
  await pool.end();
}

fs.writeFileSync('C:/tmp/qa-r129-subfixture.json', JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));
