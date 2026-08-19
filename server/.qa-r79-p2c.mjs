// Run 79 s1 pass 2c - remaining real-payload lifecycles + the contract PUBLIC SIGN flow
// done correctly (the token is minted by /send, not by create).
import fs from 'node:fs';
const API = 'http://localhost:3001';
const TOKEN = fs.readFileSync('C:/tmp/qa-token.txt', 'utf8').trim();
const IDS = JSON.parse(fs.readFileSync('C:/tmp/qa-r79-ids.json', 'utf8')).ids;
const PREV = JSON.parse(fs.readFileSync('C:/tmp/qa-r79-p2b.json', 'utf8')).created;
const LEAD = PREV.leads[0];
const R = [];
const created = { estimates: [], contracts: [], invoices: [], workOrders: [], expenses: [], tasks: [], pins: [], fields: [], lists: [], templates: [], subs: [], orders: [], docs: [] };

async function req(method, path, body, anon) {
  const h = { 'Content-Type': 'application/json' };
  if (!anon) h.Authorization = `Bearer ${TOKEN}`;
  const o = { method, headers: h };
  if (body !== undefined) o.body = JSON.stringify(body);
  const t0 = Date.now();
  try {
    const r = await fetch(API + path, o);
    const ct = r.headers.get('content-type') || '';
    let txt;
    if (ct.includes('json')) { txt = await r.text(); }
    else { const b = await r.arrayBuffer(); txt = '<' + ct + ' ' + b.byteLength + 'b>'; }
    R.push({ method, path, status: r.status, ms: Date.now() - t0, body: txt.slice(0, 400) });
    console.log(String(r.status).padEnd(4), method.padEnd(6), path.slice(0, 66).padEnd(66), txt.slice(0, 88).replace(/\n/g, ' '));
    try { return JSON.parse(txt); } catch { return txt; }
  } catch (e) {
    R.push({ method, path, status: 0, body: 'FETCH-ERR ' + e.message });
    console.log('ERR ', method, path, e.message);
    return null;
  }
}
const LI = [
  { description: 'QA79 Architectural shingles', quantity: 32, unit: 'SQ', unit_price: 385.5 },
  { description: 'QA79 Ridge vent', quantity: 60, unit: 'LF', unit_price: 12.25 },
];

console.log('===== I. CONTRACT PUBLIC SIGN (token minted by /send) =====');
const con = await req('POST', '/api/crm/contracts', { leadId: LEAD, templateType: 'roofing_standard', content: { sections: [{ title: 'QA79 Scope', body: 'QA79 roof replacement' }] } });
if (con && con.id) {
  created.contracts.push(con.id);
  const sent = await req('POST', '/api/crm/contracts/' + con.id + '/send', {});
  const ctok = sent && sent.token;
  console.log('  token minted by send:', !!ctok);
  if (ctok) {
    await req('GET', '/api/crm/contracts/public/' + ctok, undefined, true);
    await req('POST', '/api/crm/contracts/public/' + ctok + '/sign', { signerName: 'QA79 Homeowner', signatureData: 'data:image/png;base64,iVBORw0KGgo=' }, true);
    await req('GET', '/api/crm/contracts/public/' + ctok, undefined, true);
    await req('POST', '/api/crm/contracts/public/' + ctok + '/sign', { signerName: 'QA79 twice', signatureData: 'x' }, true);
    await req('GET', '/api/crm/contracts/' + con.id + '/pdf');
  }
}

console.log('===== J. ESTIMATE sign-in-person on a FRESH sent estimate =====');
const est3 = await req('POST', '/api/estimates', { lead_id: LEAD, customer_name: 'QA79 Three', line_items: LI, tax_rate: 8.25 });
if (est3 && est3.id) {
  created.estimates.push(est3.id);
  await req('POST', '/api/estimates/' + est3.id + '/send', {});
  await req('POST', '/api/estimates/' + est3.id + '/sign-in-person', { signer_name: 'QA79 InPerson', signature_data: 'data:image/png;base64,iVBORw0KGgo=' });
  await req('GET', '/api/estimates/' + est3.id + '/pdf');
}

console.log('===== K. INVOICE =====');
const inv = await req('POST', '/api/crm/invoices', { lead_id: LEAD, line_items: LI, tax_rate: 8.25, due_date: '2026-09-30', notes: 'QA79 invoice' });
if (inv && inv.id) {
  created.invoices.push(inv.id);
  await req('GET', '/api/crm/invoices/' + inv.id);
  await req('PATCH', '/api/crm/invoices/' + inv.id, { notes: 'QA79 invoice v2', line_items: LI });
  await req('POST', '/api/crm/invoices/' + inv.id + '/send', {});
  await req('POST', '/api/crm/invoices/' + inv.id + '/payment', { amount: 500, method: 'check', note: 'QA79 partial' });
  await req('POST', '/api/crm/invoices/' + inv.id + '/payment', { amount: 999999, method: 'check', note: 'QA79 overpay' });
  await req('POST', '/api/crm/invoices/' + inv.id + '/payment', { amount: -50, method: 'check' });
  await req('GET', '/api/crm/invoices/' + inv.id);
  await req('POST', '/api/crm/invoices/' + inv.id + '/send-email', {});
}
if (est3 && est3.id) {
  const inv2 = await req('POST', '/api/crm/invoices/from-estimate/' + est3.id, {});
  if (inv2 && inv2.id) created.invoices.push(inv2.id);
}

console.log('===== L. WORK ORDER + MILESTONES =====');
const wo = await req('POST', '/api/crm/work-orders', { lead_id: LEAD, title: 'QA79 Work Order', description: 'QA79 desc', line_items: LI, scheduled_date: '2026-09-15', crew_name: 'QA79 Crew' });
if (wo && wo.id) {
  created.workOrders.push(wo.id);
  await req('GET', '/api/crm/work-orders/' + wo.id);
  await req('PATCH', '/api/crm/work-orders/' + wo.id, { status: 'in_progress', crew_name: 'QA79 Crew B' });
  const ms = await req('POST', '/api/crm/work-orders/' + wo.id + '/milestones', { name: 'QA79 Milestone', sort_order: 1, photo_required: false });
  await req('GET', '/api/crm/work-orders/' + wo.id + '/milestones');
  if (ms && ms.id) {
    await req('PATCH', '/api/crm/work-orders/' + wo.id + '/milestones/' + ms.id, { completed: true });
    await req('PATCH', '/api/crm/work-orders/' + wo.id + '/milestones/' + ms.id, { completed: false });
  }
  await req('GET', '/api/crm/work-orders/' + wo.id + '/pdf');
  await req('PATCH', '/api/crm/work-orders/' + wo.id + '/complete', {});
  if (ms && ms.id) await req('DELETE', '/api/crm/work-orders/' + wo.id + '/milestones/' + ms.id);
}
if (est3 && est3.id) {
  const wo2 = await req('POST', '/api/crm/work-orders/from-estimate/' + est3.id, {});
  if (wo2 && wo2.id) created.workOrders.push(wo2.id);
}

console.log('===== M. SUBCONTRACTOR ASSIGNMENT =====');
const sub = await req('POST', '/api/crm/subcontractors', { name: 'QA79 Sub', company_name: 'QA79 Roofing LLC', email: 'qa79sub@example.com', phone: '555-0181', trade: 'roofing' });
if (sub && sub.id) {
  created.subs.push(sub.id);
  await req('GET', '/api/crm/subcontractors/' + sub.id);
  await req('PATCH', '/api/crm/subcontractors/' + sub.id, { phone: '555-0182' });
  if (wo && wo.id) {
    await req('POST', '/api/crm/subcontractors/assign', { subcontractorId: sub.id, workOrderId: wo.id, amount: 4500 });
    await req('GET', '/api/crm/subcontractors/work-order/' + wo.id);
    await req('DELETE', '/api/crm/subcontractors/work-order/' + wo.id + '/' + sub.id);
  }
}

console.log('===== N. EXPENSE / TASK / PIN / FIELD / LIST =====');
const exp = await req('POST', '/api/crm/expenses', { lead_id: LEAD, category: 'materials', amount: 1234.56, date: '2026-08-18', notes: 'QA79 expense' });
if (exp && exp.id) {
  created.expenses.push(exp.id);
  await req('PATCH', '/api/crm/expenses/' + exp.id, { amount: 1500 });
  await req('GET', '/api/crm/expenses/summary/' + LEAD);
  await req('GET', '/api/crm/expenses?leadId=' + LEAD);
}
const task = await req('POST', '/api/crm/tasks', { lead_id: LEAD, title: 'QA79 Task', due_date: '2026-08-20', priority: 'high' });
if (task && task.id) {
  created.tasks.push(task.id);
  await req('PATCH', '/api/crm/tasks/' + task.id, { completed: true });
  await req('PATCH', '/api/crm/tasks/' + task.id, { completed: false });
}
const pin = await req('POST', '/api/crm/canvass-pins', { lat: 32.75, lng: -97.33, outcome: 'interested', notes: 'QA79 pin', address: '79 QA79 Test Ln' });
if (pin && pin.id) {
  created.pins.push(pin.id);
  await req('PATCH', '/api/crm/canvass-pins/' + pin.id, { outcome: 'appointment', notes: 'QA79 pin v2' });
  await req('GET', '/api/crm/canvass-pins/stats');
  const conv = await req('POST', '/api/crm/canvass-pins/' + pin.id + '/convert', {});
  if (conv && conv.id) created.convertedLead = conv.id;
  if (conv && conv.lead && conv.lead.id) created.convertedLead = conv.lead.id;
}
const cf = await req('POST', '/api/crm/custom-fields', { field_label: 'QA79 Field', field_type: 'text', entity_type: 'lead' });
if (cf && cf.id) {
  created.fields.push(cf.id);
  await req('PATCH', '/api/crm/custom-fields/' + cf.id, { field_label: 'QA79 Field v2' });
  await req('DELETE', '/api/crm/custom-fields/' + cf.id);
  created.fields.pop();
}
const pl = await req('POST', '/api/crm/prospect-lists', { name: 'QA79 List', propertyIds: [IDS.property] });
if (pl && pl.id) {
  created.lists.push(pl.id);
  await req('GET', '/api/crm/prospect-lists/' + pl.id + '/items');
  await req('DELETE', '/api/crm/prospect-lists/' + pl.id + '/items/' + IDS.property);
  await req('DELETE', '/api/crm/prospect-lists/' + pl.id);
  created.lists.pop();
}

console.log('===== O. TEMPLATES =====');
const ct2 = await req('POST', '/api/crm/contracts/templates', { name: 'QA79 Contract Template', template_type: 'roofing_standard', content: { sections: [{ title: 'QA79', body: 'QA79' }] } });
if (ct2 && ct2.id) {
  await req('PATCH', '/api/crm/contracts/templates/' + ct2.id, { name: 'QA79 Contract Template v2' });
  await req('DELETE', '/api/crm/contracts/templates/' + ct2.id);
}
const et = await req('POST', '/api/estimates/templates', { name: 'QA79 Estimate Template', line_items: LI });
if (et && et.id) {
  await req('PATCH', '/api/estimates/templates/' + et.id, { name: 'QA79 Estimate Template v2' });
  await req('DELETE', '/api/estimates/templates/' + et.id);
}

console.log('===== P. MISC WRITES =====');
await req('POST', '/api/crm/leads/bulk-assign', { leadIds: [LEAD], assignedRepId: IDS.teamUser });
await req('POST', '/api/notifications/mark-all-read', {});
await req('GET', '/api/notifications/unread-count');
await req('PATCH', '/api/notifications/preferences', { notification_type: 'lead_assigned', in_app: true, email: true });
await req('POST', '/api/properties/geocode', { address: '400 W 15th St', city: 'Austin', state: 'TX', zip: '78701' });
await req('GET', '/api/properties/reverse-geocode?lat=32.75&lng=-97.33');
await req('POST', '/api/data/optimize-route', { stops: [{ lat: 32.75, lng: -97.33, id: 'a' }, { lat: 32.76, lng: -97.34, id: 'b' }, { lat: 32.77, lng: -97.31, id: 'c' }] });
await req('POST', '/api/roof-measurement/manual', { propertyId: IDS.property, roof_sqft: 2400, pitch: '6/12', stories: 1 });
await req('GET', '/api/roof-measurement/segments/' + IDS.property);
await req('GET', '/api/roof-measurement/solar/' + IDS.property);
await req('POST', '/api/materials/orders', { branch_id: 'test', items: [{ product_id: 'srs-shingle-001', quantity: 5 }], notes: 'QA79 order' });

fs.writeFileSync('C:/tmp/qa-r79-p2c.json', JSON.stringify({ created, R }, null, 1));
const bad = R.filter((v) => v.status >= 500 || v.status === 0);
console.log('\n5xx count:', bad.length);
for (const x of bad) console.log('   ', x.status, x.method, x.path, x.body.slice(0, 300));
console.log('CREATED:', JSON.stringify(created));
