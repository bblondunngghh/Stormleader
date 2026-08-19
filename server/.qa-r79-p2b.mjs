// Run 79 s1 pass 2b - real-payload lifecycle: lead, estimate, PUBLIC TOKEN flows, contract.
// The public-token routes have never been reachable in any prior run.
import fs from 'node:fs';
const API = 'http://localhost:3001';
const TOKEN = fs.readFileSync('C:/tmp/qa-token.txt', 'utf8').trim();
const IDS = JSON.parse(fs.readFileSync('C:/tmp/qa-r79-ids.json', 'utf8')).ids;
const R = [];
const created = { leads: [], estimates: [], contracts: [], invoices: [], workOrders: [], other: [] };

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
    console.log(String(r.status).padEnd(4), method.padEnd(6), path.slice(0, 70).padEnd(70), txt.slice(0, 90).replace(/\n/g, ' '));
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

console.log('===== E. LEAD =====');
const lead = await req('POST', '/api/crm/leads', { propertyId: IDS.property, source: 'canvassing' });
if (lead && lead.id) {
  created.leads.push(lead.id);
  await req('GET', '/api/crm/leads/' + lead.id);
  await req('PATCH', '/api/crm/leads/' + lead.id, { stage: 'appt_set', notes: 'QA79 note' });
  await req('PATCH', '/api/crm/leads/' + lead.id + '/roof-type', { roof_type: 'asphalt_shingle' });
  await req('POST', '/api/crm/leads/' + lead.id + '/score', {});
  const ct = await req('POST', '/api/crm/leads/' + lead.id + '/contacts', { name: 'QA79 Spouse', email: 'qa79b@example.com', phone: '555-0180', role: 'spouse' });
  await req('GET', '/api/crm/leads/' + lead.id + '/activities');
  await req('POST', '/api/crm/activities', { lead_id: lead.id, type: 'note', description: 'QA79 activity' });
  await req('GET', '/api/crm/leads/' + lead.id + '/activities');
  if (ct && ct.id) await req('DELETE', '/api/crm/leads/' + lead.id + '/contacts/' + ct.id);
  await req('POST', '/api/crm/leads/bulk-assign', { leadIds: [lead.id], assigned_rep_id: IDS.teamUser });
  await req('POST', '/api/crm/leads/bulk-status', { leadIds: [lead.id], stage: 'estimate_sent' });
}
const quick = await req('POST', '/api/crm/leads/quick', { address: '80 QA79 Quick Ln', city: 'Fort Worth', state: 'TX', zip: '76102', contact_name: 'QA79 Quick' });
if (quick && quick.id) created.leads.push(quick.id);

console.log('===== F. ESTIMATE + PUBLIC TOKEN =====');
const est = await req('POST', '/api/estimates', {
  lead_id: lead && lead.id, customer_name: 'QA79 Homeowner', customer_address: '79 QA79 Test Ln',
  customer_email: 'qa79@example.com', customer_phone: '555-0179',
  line_items: LI, tax_rate: 8.25, notes: 'QA79 estimate',
});
let tok = null;
if (est && est.id) {
  created.estimates.push(est.id);
  tok = est.public_token || null;
  await req('GET', '/api/estimates/' + est.id);
  await req('PATCH', '/api/estimates/' + est.id, { notes: 'QA79 updated', line_items: LI });
  await req('GET', '/api/estimates/' + est.id + '/pdf');
  const tiers = await req('POST', '/api/estimates/' + est.id + '/generate-tiers', {});
  if (tiers && tiers.tiers) for (const t of tiers.tiers) created.estimates.push(t.id);
  await req('POST', '/api/estimates/' + est.id + '/send', {});
  console.log('  public_token present in create response:', !!tok);
}
if (tok) {
  console.log('--- public (unauthenticated) ---');
  await req('GET', '/api/estimates/public/' + tok, undefined, true);
  await req('GET', '/api/crm/financing/public/' + tok + '/plans', undefined, true);
  await req('GET', '/api/crm/financing/public/' + tok + '/applications', undefined, true);
  await req('POST', '/api/crm/financing/public/' + tok + '/apply', { planId: '39f9d453-73b1-49fb-ab58-835517cb2dde', amount: 1250000, customerName: 'QA79 Homeowner', customerEmail: 'qa79@example.com' }, true);
  await req('POST', '/api/estimates/public/' + tok + '/accept', { signer_name: 'QA79 Homeowner', signature_data: 'data:image/png;base64,iVBORw0KGgo=' }, true);
  await req('GET', '/api/estimates/public/' + tok, undefined, true);
  await req('POST', '/api/estimates/public/' + tok + '/decline', {}, true);
}

console.log('===== F2. second estimate: decline + sign-in-person + duplicate =====');
const est2 = await req('POST', '/api/estimates', { lead_id: lead && lead.id, customer_name: 'QA79 Two', line_items: LI, tax_rate: 8.25 });
if (est2 && est2.id) {
  created.estimates.push(est2.id);
  await req('POST', '/api/estimates/' + est2.id + '/send', {});
  if (est2.public_token) {
    await req('POST', '/api/estimates/public/' + est2.public_token + '/decline', {}, true);
    await req('POST', '/api/estimates/public/' + est2.public_token + '/accept', { signer_name: 'QA79 late' }, true);
  }
  const dup = await req('POST', '/api/estimates/' + est2.id + '/duplicate', {});
  if (dup && dup.id) created.estimates.push(dup.id);
  await req('POST', '/api/estimates/' + est2.id + '/sign-in-person', { signer_name: 'QA79 InPerson', signature_data: 'data:image/png;base64,iVBORw0KGgo=' });
}

console.log('===== G. CONTRACT + PUBLIC SIGN =====');
const con = await req('POST', '/api/crm/contracts', { leadId: lead && lead.id, estimateId: est && est.id, templateType: 'roofing_standard', content: 'QA79 contract body' });
if (con && con.id) {
  created.contracts.push(con.id);
  await req('GET', '/api/crm/contracts/' + con.id);
  await req('PATCH', '/api/crm/contracts/' + con.id, { content: 'QA79 contract body v2' });
  await req('GET', '/api/crm/contracts/' + con.id + '/pdf');
  await req('POST', '/api/crm/contracts/' + con.id + '/send', {});
  const ctok = con.token;
  if (ctok) {
    await req('GET', '/api/crm/contracts/public/' + ctok, undefined, true);
    await req('POST', '/api/crm/contracts/public/' + ctok + '/sign', { signerName: 'QA79 Homeowner', signatureData: 'data:image/png;base64,iVBORw0KGgo=' }, true);
    await req('GET', '/api/crm/contracts/public/' + ctok, undefined, true);
    await req('POST', '/api/crm/contracts/public/' + ctok + '/sign', { signerName: 'QA79 twice', signatureData: 'x' }, true);
  }
  await req('GET', '/api/crm/contracts/' + con.id + '/pdf');
  await req('POST', '/api/crm/contracts/' + con.id + '/void', {});
}

console.log('===== H. LEAD STATUS PUBLIC TOKEN =====');
if (lead && lead.id) {
  const st = await req('POST', '/api/leads/' + lead.id + '/status-token', {});
  if (st && st.token) await req('GET', '/api/leads/status/public/' + st.token, undefined, true);
}

fs.writeFileSync('C:/tmp/qa-r79-p2b.json', JSON.stringify({ created, R }, null, 1));
const bad = R.filter((v) => v.status >= 500 || v.status === 0);
console.log('\n5xx count:', bad.length);
for (const x of bad) console.log('   ', x.status, x.method, x.path, x.body.slice(0, 250));
console.log('CREATED:', JSON.stringify(created));
