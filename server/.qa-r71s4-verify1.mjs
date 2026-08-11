import {login,mk} from './.qa-r71s4-lib.mjs';
const {api,raw} = mk(await login());

console.log('===== b8a76c3  contract PDF (JSONB shapes) — regression on real rows');
const cl = await api('/api/crm/contracts?limit=100');
const arr = cl.d?.contracts || cl.d?.data || (Array.isArray(cl.d)?cl.d:[]);
console.log('list', cl.s, 'count', arr.length);
let bad=0;
for (const c of arr){
  const r = await raw(`/api/crm/contracts/${c.id}/pdf`);
  const magic = r.buf.slice(0,4).toString();
  const ok = r.s===200 && magic==='%PDF';
  if(!ok){bad++; console.log(`  *** BAD ${c.contract_number||c.id} -> ${r.s} ${r.buf.slice(0,200).toString()}`);}
  else console.log(`  ${(c.contract_number||c.id.slice(0,8)).padEnd(14)} ${r.s} ${String(r.buf.length).padStart(6)}b %PDF ok  content_type=${typeof c.content}`);
}
console.log('contract pdf failures:', bad);

console.log('\n===== 8e67255  task completion vs dashboard Today panel');
const tasks = await api('/api/crm/tasks?limit=200');
const tl = tasks.d?.tasks || tasks.d?.data || (Array.isArray(tasks.d)?tasks.d:[]);
console.log('tasks', tasks.s, 'count', tl.length);
for(const t of tl) console.log(`  ${t.id.slice(0,8)} status=${String(t.status).padEnd(10)} completed_at=${t.completed_at?'SET ':'null'} due=${(t.due_date||'').slice(0,10)} ${(t.title||'').slice(0,44)}`);
const contradictory = tl.filter(t => (t.completed_at && t.status!=='completed') || (!t.completed_at && t.status==='completed'));
console.log('CONTRADICTORY rows (completed_at vs status):', contradictory.length);

for (const u of ['/api/crm/dashboard/tasks-today','/api/crm/dashboard/today','/api/crm/dashboard/summary']){
  const r = await api(u);
  console.log(`  ${u} -> ${r.s} ${r.t.slice(0,220)}`);
}
