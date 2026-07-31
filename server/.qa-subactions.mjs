// QA PHASE 4 — happy-path SUB-ACTIONS with valid data (create-from / convert / enroll /
// assign / toggle / token), plus a live GET smoke across every mount prefix.
// Rows created here are tracked and torn down at the end.
import fs from 'fs';

const BASE = 'http://localhost:3001/api';
const TOKEN = fs.readFileSync('C:/tmp/qa-token.txt', 'utf8').trim();
const rows = [];
const madeRows = []; // {table, id} for DB teardown where no DELETE route exists

async function req(method, path, body, expect) {
  const opts = { method, headers: { Authorization: `Bearer ${TOKEN}` } };
  if (body !== undefined) { opts.headers['Content-Type'] = 'application/json'; opts.body = JSON.stringify(body); }
  let status = 0, json = null, text = '';
  try {
    const res = await fetch(BASE + path, opts);
    status = res.status; text = await res.text();
    try { json = JSON.parse(text); } catch { json = null; }
  } catch (e) { text = 'FETCH_ERROR ' + e.message; }
  const exp = Array.isArray(expect) ? expect : [expect];
  const ok = exp.includes(status);
  rows.push({ method, path, status, expect: exp.join('/'), ok, note: ok ? '' : (text || '').slice(0, 220).replace(/\s+/g, ' ') });
  console.log(`  ${ok ? '✓' : '✗'} ${method} ${path} -> ${status}${ok ? '' : ` (want ${exp.join('/')}) ${(text || '').slice(0, 170)}`}`);
  return { status, json, text, ok };
}
function check(label, cond, detail = '') {
  rows.push({ method: 'ASSERT', path: label, status: cond ? 'PASS' : 'FAIL', expect: 'PASS', ok: !!cond, note: cond ? '' : detail });
  console.log(`  ${cond ? '✓' : '✗'} ASSERT ${label}${cond ? '' : ' — ' + detail}`);
}

const stamp = 'qa20260730c';
const LEAD = 'dc8135aa-b210-4f33-bbe1-ad8f0997d3dd';
const EST = '1252940b-b691-4182-8d4f-680ac71a0711';

// ---------- 1. work order from estimate + complete ----------
console.log('\n=== work-orders: from-estimate + complete ===');
const wofe = await req('POST', `/crm/work-orders/from-estimate/${EST}`, {}, [201, 400, 404, 409]);
if (wofe.status === 201 && wofe.json?.id) {
  madeRows.push({ table: 'work_orders', id: wofe.json.id });
  check('from-estimate copied the estimate link', wofe.json.estimate_id === EST, `got ${wofe.json.estimate_id}`);
  const comp = await req('PATCH', `/crm/work-orders/${wofe.json.id}/complete`, {}, [200, 400]);
  if (comp.status === 200) check('complete set completed_at', !!comp.json?.completed_at, JSON.stringify(comp.json).slice(0, 160));
}

// ---------- 2. invoice from estimate ----------
console.log('\n=== invoices: from-estimate ===');
const invfe = await req('POST', `/crm/invoices/from-estimate/${EST}`, {}, [201, 400, 404, 409]);
if (invfe.status === 201 && invfe.json?.id) {
  madeRows.push({ table: 'invoices', id: invfe.json.id });
  check('invoice from-estimate has a number', !!invfe.json.invoice_number, JSON.stringify(invfe.json).slice(0, 160));
}

// ---------- 3. estimate duplicate (has a DELETE route) ----------
console.log('\n=== estimates: duplicate + templates ===');
const dup = await req('POST', `/estimates/${EST}/duplicate`, {}, [200, 201, 404]);
if ((dup.status === 201 || dup.status === 200) && dup.json?.id) {
  check('duplicate produced a NEW id', dup.json.id !== EST, `same id ${dup.json.id}`);
  await req('DELETE', `/estimates/${dup.json.id}`, undefined, [200, 204]);
}
const tmpl = await req('POST', '/estimates/templates', { name: `${stamp} tmpl`, line_items: [{ description: 'qa', quantity: 1, unit_price: 1 }] }, [200, 201, 400]);
if ((tmpl.status === 201 || tmpl.status === 200) && tmpl.json?.id) {
  await req('DELETE', `/estimates/templates/${tmpl.json.id}`, undefined, [200, 204, 404]);
}

// ---------- 4. contract create + void ----------
console.log('\n=== contracts: create + void ===');
const con = await req('POST', '/crm/contracts', { lead_id: LEAD, title: `${stamp} contract` }, [201, 400]);
if (con.status === 201 && con.json?.id) {
  madeRows.push({ table: 'contracts', id: con.json.id });
  const v = await req('POST', `/crm/contracts/${con.json.id}/void`, {}, [200, 400]);
  if (v.status === 200) check('void set status', v.json?.status === 'void' || v.json?.status === 'voided', `got ${v.json?.status}`);
}

// ---------- 5. drip enroll + cancel ----------
console.log('\n=== drip-sequences: enroll + cancel ===');
const seq = await req('POST', '/crm/drip-sequences', {
  name: `${stamp} seq`, trigger_type: 'manual', trigger_config: {},
  steps: [{ step_order: 1, delay_days: 1, channel: 'email', subject: 'qa', body: 'qa' }],
}, 201);
if (seq.ok && seq.json?.id) {
  const sid = seq.json.id;
  const eBad = await req('POST', `/crm/drip-sequences/${sid}/enroll`, {}, 400);
  check('enroll without leadId -> 400', eBad.status === 400, `got ${eBad.status}`);
  const e = await req('POST', `/crm/drip-sequences/${sid}/enroll`, { leadId: LEAD }, [200, 201, 400, 409]);
  check('enroll with valid leadId not 5xx', e.status < 500, `got ${e.status}`);
  const c = await req('POST', `/crm/drip-sequences/${sid}/cancel`, { leadId: LEAD }, [200, 201, 404]);
  check('cancel not 5xx', c.status < 500, `got ${c.status}`);
  await req('DELETE', `/crm/drip-sequences/${sid}`, undefined, [200, 204]);
}

// ---------- 6. canvass pin -> lead conversion ----------
console.log('\n=== canvass-pins: convert to lead ===');
const pin = await req('POST', '/crm/canvass-pins', { lat: 30.3551, lng: -97.7451, outcome: 'interested', address: `${stamp} 456 Convert St` }, 201);
if (pin.ok && pin.json?.id) {
  madeRows.push({ table: 'canvass_pins', id: pin.json.id });
  const conv = await req('POST', `/crm/canvass-pins/${pin.json.id}/convert`, {}, [200, 201, 400]);
  if (conv.status === 201 || conv.status === 200) {
    check('convert returned a lead id', !!conv.json?.id, JSON.stringify(conv.json).slice(0, 160));
    // converting twice must be a clean 400, not a duplicate lead
    const again = await req('POST', `/crm/canvass-pins/${pin.json.id}/convert`, {}, 400);
    check('double-convert -> 400 (no duplicate lead)', again.status === 400, `got ${again.status}`);
    if (conv.json?.id) await req('DELETE', `/crm/leads/${conv.json.id}`, undefined, [200, 204, 404]);
  }
}

// ---------- 7. subcontractor assign to work order ----------
console.log('\n=== subcontractors: assign / list / remove ===');
const sub = await req('POST', '/crm/subcontractors', { name: `${stamp} sub`, specialty: 'roofing' }, 201);
const wo = await req('POST', '/crm/work-orders', { title: `${stamp} assign-target` }, 201);
if (sub.ok && wo.ok && sub.json?.id && wo.json?.id) {
  madeRows.push({ table: 'work_orders', id: wo.json.id });
  const aBad = await req('POST', '/crm/subcontractors/assign', { work_order_id: wo.json.id }, 400);
  check('assign without subcontractor_id -> 400', aBad.status === 400, `got ${aBad.status}`);
  const a = await req('POST', '/crm/subcontractors/assign', { work_order_id: wo.json.id, subcontractor_id: sub.json.id, role: 'installer', agreed_rate: 50 }, [200, 201]);
  check('assign accepted', a.status < 400, `got ${a.status}`);
  const list = await req('GET', `/crm/subcontractors/work-order/${wo.json.id}`, undefined, 200);
  check('work-order sub list includes the assignment', Array.isArray(list.json) && list.json.some((s) => s.subcontractor_id === sub.json.id || s.id === sub.json.id), JSON.stringify(list.json).slice(0, 200));
  const rm = await req('DELETE', `/crm/subcontractors/work-order/${wo.json.id}/${sub.json.id}`, undefined, [200, 204]);
  check('assignment removed', rm.ok, `got ${rm.status}`);
  await req('DELETE', `/crm/subcontractors/${sub.json.id}`, undefined, [200, 204]);
}

// ---------- 8. lead public status token ----------
console.log('\n=== leads: status-token ===');
const tok = await req('POST', `/leads/${LEAD}/status-token`, {}, [200, 201]);
if (tok.ok) {
  check('status-token returns token + url', !!tok.json?.token && !!tok.json?.url, JSON.stringify(tok.json).slice(0, 160));
  // regenerating must upsert, not error (ON CONFLICT (lead_id) DO UPDATE)
  const tok2 = await req('POST', `/leads/${LEAD}/status-token`, {}, [200, 201]);
  check('regenerate rotates the token (upsert, no 5xx)', tok2.ok && tok2.json?.token && tok2.json.token !== tok.json.token,
    `first ${String(tok.json?.token).slice(0, 12)} second ${String(tok2.json?.token).slice(0, 12)}`);
}

// ---------- 9. financing plans / lenders ----------
console.log('\n=== financing: lenders CRUD ===');
const len = await req('POST', '/crm/financing/lenders', { name: `${stamp} lender`, is_active: true }, [200, 201, 400]);
if ((len.status === 201 || len.status === 200) && len.json?.id) {
  const p = await req('PATCH', `/crm/financing/lenders/${len.json.id}`, { name: `${stamp} lender patched` }, [200, 400]);
  check('lender patch not 5xx', p.status < 500, `got ${p.status}`);
  await req('DELETE', `/crm/financing/lenders/${len.json.id}`, undefined, [200, 204, 404]);
}

// ---------- 10. prospect lists ----------
console.log('\n=== prospect-lists ===');
const pl = await req('POST', '/crm/prospect-lists', { name: `${stamp} list` }, [200, 201, 400]);
if ((pl.status === 201 || pl.status === 200) && pl.json?.id) {
  await req('DELETE', `/crm/prospect-lists/${pl.json.id}`, undefined, [200, 204]);
}

// ---------- 11. notifications create + read + mark-all ----------
console.log('\n=== notifications ===');
const nt = await req('POST', '/notifications', { title: `${stamp} notif`, message: 'qa', type: 'system' }, [200, 201, 400]);
if ((nt.status === 201 || nt.status === 200) && nt.json?.id) {
  madeRows.push({ table: 'notifications', id: nt.json.id });
  const r = await req('PATCH', `/notifications/${nt.json.id}/read`, {}, [200, 204]);
  check('notification marked read', r.ok, `got ${r.status}`);
}
await req('POST', '/notifications/mark-all-read', {}, [200, 204]);

// ---------- 12. GET smoke across every mount prefix ----------
console.log('\n=== GET smoke across all mount prefixes ===');
const smoke = [
  ['/dashboard/stats', 200], ['/dashboard/funnel', 200], ['/dashboard/activity', 200],
  ['/crm/leads?limit=1', 200], ['/crm/tasks', 200], ['/crm/team', 200], ['/crm/pipeline-stages', 200],
  ['/crm/activities?limit=1', 200], ['/crm/custom-fields', 200], ['/crm/prospect-lists', 200],
  ['/crm/expenses', 200], ['/crm/subcontractors', 200], ['/crm/territories', 200],
  ['/crm/canvass-pins/stats', 200], ['/crm/automations', 200], ['/crm/drip-sequences', 200],
  ['/crm/invoices', 200], ['/crm/contracts', 200], ['/crm/contracts/templates', 200],
  ['/crm/work-orders', 200], ['/crm/work-orders/milestone-templates', 200],
  ['/crm/reports/revenue', 200], ['/crm/reports/pipeline', 200],
  ['/crm/financing/plans', 200], ['/crm/financing/lenders', 200],
  ['/estimates?limit=1', 200], ['/notifications', 200], ['/search?q=austin', 200],
  ['/alerts/config', 200], ['/alerts/history', 200],
  ['/roof-measurement/config', 200], ['/skip-trace/config', 200],
  ['/materials/products?limit=1', 200], ['/materials/credentials', 200],
  ['/payments/connect-status', 200], ['/onboarding/plans', 200],
  ['/storm-history?lat=30.35&lng=-97.75', 200],
  ['/disaster-declarations?state=TX&county=Travis', 200],
  ['/data/fema-housing?zip=78750', 200],
  ['/storms?limit=1', 200], ['/counties?limit=1', 200], ['/drift', [200, 400, 404]],
  ['/admin/tenants', 403],
];
for (const [p, exp] of smoke) await req('GET', p, undefined, exp);

// ---------- teardown ----------
console.log('\n=== TEARDOWN (rows with no DELETE route) ===');
fs.writeFileSync('C:/tmp/qa-made-rows.json', JSON.stringify(madeRows, null, 1));
console.log(JSON.stringify(madeRows));

const fails = rows.filter((r) => !r.ok);
const fivexx = rows.filter((r) => typeof r.status === 'number' && r.status >= 500);
console.log('\n================ PHASE 4 SUMMARY ================');
console.log('checks:', rows.length, '| failures:', fails.length, '| 5xx:', fivexx.length);
if (fivexx.length) { console.log('\n--- 5xx (REAL BUGS) ---'); fivexx.forEach((r) => console.log(`${r.method} ${r.path} -> ${r.status} :: ${r.note}`)); }
if (fails.length) { console.log('\n--- FAILURES ---'); fails.forEach((r) => console.log(`${r.method} ${r.path} -> ${r.status} (want ${r.expect}) :: ${r.note}`)); }
fs.writeFileSync('C:/tmp/subactions-raw.json', JSON.stringify(rows, null, 1));
