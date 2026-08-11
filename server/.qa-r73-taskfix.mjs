import pool from './src/db/pool.js';
const BASE = 'http://localhost:3001';
const T = '791bb51d-3293-4839-92e9-bd4d4f873af2';
const login = await fetch(`${BASE}/api/auth/login`, { method:'POST', headers:{'Content-Type':'application/json'},
  body: JSON.stringify({ email:'waterlooconstruction1@gmail.com', password:'2Wealth&health', tenantSlug:'waterloo' })});
const { accessToken } = await login.json();
const H = { Authorization:`Bearer ${accessToken}`, 'Content-Type':'application/json' };
const j = async (m,p,b) => { const r = await fetch(BASE+p,{method:m,headers:H,body:b?JSON.stringify(b):undefined});
  return { s:r.status, b: await r.json().catch(()=>null) }; };

const today = async () => (await j('GET','/api/crm/dashboard/tasks-today')).b.tasks;
console.log('A. tasks-today with the 3 pre-existing contradictory rows:', (await today()).length, '(was 3 before the read-path guard)');

const mk = await j('POST','/api/crm/tasks',{ title:'QA73 task-sync probe', priority:'warm' });
const id = mk.b.task?.id || mk.b.id;
console.log('B. created probe task', mk.s, id);

const inToday = (await today()).some(t => t.id === id);
console.log('C. probe appears in dashboard Today panel:', inToday);

const pat = await j('PATCH', `/api/crm/tasks/${id}`, { completed_at: new Date().toISOString() });
console.log('D. PATCH completed_at ->', pat.s);

const { rows:[row] } = await pool.query('SELECT status, completed_at IS NOT NULL AS done FROM tasks WHERE id=$1',[id]);
console.log('E. DB row after PATCH: status=%s completed_at_set=%s  <-- status must be "completed"', row.status, row.done);

const stillToday = (await today()).some(t => t.id === id);
console.log('F. still in dashboard Today panel after completing:', stillToday, '(must be false)');

const done = await j('GET','/api/crm/tasks?completed=true');
const pend = await j('GET','/api/crm/tasks?completed=false');
const dl = done.b.tasks||done.b, pl = pend.b.tasks||pend.b;
console.log('G. /tasks Completed contains probe:', dl.some(t=>t.id===id), ' Pending count:', pl.length);

// un-complete round trip
await j('PATCH', `/api/crm/tasks/${id}`, { completed_at: null });
const { rows:[row2] } = await pool.query('SELECT status FROM tasks WHERE id=$1',[id]);
const backToday = (await today()).some(t => t.id === id);
console.log('H. un-complete -> status=%s, back in Today panel: %s (both must revert)', row2.status, backToday);

await pool.query('DELETE FROM tasks WHERE id=$1',[id]);
const { rows:[c] } = await pool.query('SELECT count(*) FROM tasks WHERE tenant_id=$1',[T]);
console.log('I. probe deleted; tenant task count back to', c.count, '(net DB writes 0)');
await pool.end();
