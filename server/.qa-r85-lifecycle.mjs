// Run 85 s1 — real-id CREATE -> READ -> UPDATE -> DELETE -> VERIFY-GONE -> DOUBLE-DELETE
// over the entity families whose DELETE route no previous run has ever exercised.
//
// Why: the dead-uuid probe (.qa-r85-delprobe.mjs) 404s before handler logic runs, so it
// proves only that validation holds. Every stored-shape crash this pipeline has found
// needed a REAL id (qa_standing_gotchas). This harness is self-cleaning by construction:
// each family deletes exactly what it created, so net row growth is zero.
import fs from 'fs';

const BASE = 'http://localhost:3001/api';
const TOKEN = fs.readFileSync('C:/tmp/qa-token.txt', 'utf8').trim();
const IDS = JSON.parse(fs.readFileSync('C:/tmp/qa-r85-ids.json', 'utf8'));
const STAMP = 'qa20260822';

const rows = [];
const orphans = [];   // anything created that we could NOT delete — printed at the end

async function req(method, path, body, expect, opts = {}) {
  const o = { method, headers: { Authorization: `Bearer ${TOKEN}` } };
  if (body instanceof FormData) o.body = body;
  else if (body !== undefined) { o.headers['Content-Type'] = 'application/json'; o.body = JSON.stringify(body); }
  let status = 0, json = null, text = '';
  try {
    const res = await fetch(BASE + path, o);
    status = res.status;
    text = await res.text();
    try { json = JSON.parse(text); } catch { json = null; }
  } catch (e) { text = 'FETCH_ERROR ' + e.message; }
  const exp = Array.isArray(expect) ? expect : [expect];
  const ok = exp.includes(status);
  rows.push({ method, path: opts.label || path, status, expect: exp.join('/'), ok, note: ok ? '' : text.slice(0, 200).replace(/\s+/g, ' ') });
  console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${method} ${opts.label || path} -> ${status}${ok ? '' : ` (want ${exp.join('/')}) ${text.slice(0, 150)}`}`);
  return { status, json, text, ok };
}
function check(label, cond, detail = '') {
  rows.push({ method: 'ASSERT', path: label, status: cond ? 'PASS' : 'FAIL', expect: 'PASS', ok: !!cond, note: cond ? '' : detail });
  console.log(`  ${cond ? 'ok  ' : 'FAIL'} ASSERT ${label}${cond ? '' : ' — ' + detail}`);
}

// ---------------------------------------------------------------- 1. estimate templates
console.log('\n=== estimate_templates ===');
{
  const c = await req('POST', '/estimates/templates', { name: `${STAMP} tmpl`, unit: 'sq', default_unit_price: 12.5, section: 'Roof' }, 201);
  const id = c.json?.id;
  if (id) {
    orphans.push(['estimate_templates', id]);
    await req('PATCH', `/estimates/templates/${id}`, { default_unit_price: 99 }, 200, { label: '/estimates/templates/:id' });
    await req('PATCH', `/estimates/templates/${id}`, {}, 400, { label: '/estimates/templates/:id (empty)' });
    const d = await req('DELETE', `/estimates/templates/${id}`, undefined, 200, { label: '/estimates/templates/:id' });
    if (d.ok) orphans.pop();
    await req('DELETE', `/estimates/templates/${id}`, undefined, 404, { label: '/estimates/templates/:id (double)' });
  }
}

// ---------------------------------------------------------------- 2. contract templates
console.log('\n=== contract_templates ===');
{
  const c = await req('POST', '/crm/contracts/templates', { name: `${STAMP} ctmpl`, type: 'roofing', content: 'Body {{customer_name}}' }, 201);
  const id = c.json?.id;
  if (id) {
    orphans.push(['contract_templates', id]);
    await req('GET', '/crm/contracts/templates', undefined, 200);
    await req('PATCH', `/crm/contracts/templates/${id}`, { name: `${STAMP} ctmpl2` }, 200, { label: '/crm/contracts/templates/:id' });
    const d = await req('DELETE', `/crm/contracts/templates/${id}`, undefined, 200, { label: '/crm/contracts/templates/:id' });
    if (d.ok) orphans.pop();
    await req('DELETE', `/crm/contracts/templates/${id}`, undefined, 404, { label: '/crm/contracts/templates/:id (double)' });
  }
}

// ---------------------------------------------------------------- 3. lead contacts
console.log('\n=== lead contacts ===');
{
  const lead = IDS.lead;
  const c = await req('POST', `/crm/leads/${lead}/contacts`, { first_name: `${STAMP}`, last_name: 'Contact', email: 'qa@example.invalid' }, 201, { label: '/crm/leads/:id/contacts' });
  const id = c.json?.id;
  if (id) {
    orphans.push(['contacts', id]);
    // The handler ignores :leadId and deletes by contactId alone — prove it with a WRONG leadId.
    const wrongLead = '00000000-0000-4000-8000-000000000000';
    const d0 = await req('DELETE', `/crm/leads/${wrongLead}/contacts/${id}`, undefined, [200, 404], { label: '/crm/leads/:leadId/contacts/:contactId (WRONG leadId)' });
    check('contact delete is scoped to its lead', d0.status === 404,
      `DELETE with a leadId that does not own the contact returned ${d0.status} — :leadId is ignored (crm.js:325)`);
    if (d0.status === 200) orphans.pop();
    else {
      const d = await req('DELETE', `/crm/leads/${lead}/contacts/${id}`, undefined, 200, { label: '/crm/leads/:leadId/contacts/:contactId' });
      if (d.ok) orphans.pop();
    }
    await req('DELETE', `/crm/leads/${lead}/contacts/${id}`, undefined, 404, { label: '/crm/leads/:leadId/contacts/:contactId (double)' });
  }
}

// ---------------------------------------------------------------- 4. subcontractor assignment
console.log('\n=== subcontractor work-order assignment ===');
{
  const s = await req('POST', '/crm/subcontractors', { name: `${STAMP} sub`, specialty: 'roofing' }, 201);
  const subId = s.json?.id;
  const woId = IDS.workOrder;
  if (subId) {
    orphans.push(['subcontractors', subId]);
    const a = await req('POST', '/crm/subcontractors/assign', { work_order_id: woId, subcontractor_id: subId, role: 'crew', agreed_rate: 50 }, 201);
    if (a.ok) {
      const g = await req('GET', `/crm/subcontractors/work-order/${woId}`, undefined, 200, { label: '/crm/subcontractors/work-order/:workOrderId' });
      check('assignment is readable back', Array.isArray(g.json) && g.json.some(x => x.subcontractor_id === subId || x.id === subId),
        `GET returned ${JSON.stringify(g.json).slice(0, 160)}`);
      await req('DELETE', `/crm/subcontractors/work-order/${woId}/${subId}`, undefined, 200, { label: '/crm/subcontractors/work-order/:workOrderId/:subcontractorId' });
      await req('DELETE', `/crm/subcontractors/work-order/${woId}/${subId}`, undefined, 404, { label: '.../work-order/:workOrderId/:subcontractorId (double)' });
    }
    const d = await req('DELETE', `/crm/subcontractors/${subId}`, undefined, 200, { label: '/crm/subcontractors/:id' });
    if (d.ok) orphans.pop();
  }
}

// ---------------------------------------------------------------- 5. documents
console.log('\n=== documents (local disk storage, no vendor call) ===');
{
  const mk = (tags) => {
    const fd = new FormData();
    fd.append('file', new Blob([`${STAMP} qa text file`], { type: 'text/plain' }), `${STAMP}.txt`);
    fd.append('type', 'other');
    fd.append('lead_id', IDS.lead);
    if (tags !== undefined) fd.append('tags', tags);
    return fd;
  };
  // valid JSON tags
  const c = await req('POST', '/documents/upload', mk('["qa"]'), 201);
  const id = c.json?.id;
  if (id) {
    orphans.push(['documents', id]);
    await req('GET', '/documents', undefined, 200);
    const d = await req('DELETE', `/documents/${id}`, undefined, 200, { label: '/documents/:id' });
    if (d.ok) orphans.pop();
    await req('DELETE', `/documents/${id}`, undefined, 404, { label: '/documents/:id (double)' });
  }
  // malformed tags: documents.js:96 does JSON.parse(req.body.tags) with no guard
  const bad = await req('POST', '/documents/upload', mk('not-json'), 400, { label: '/documents/upload (malformed tags)' });
  check('malformed tags is a 400, not a 500', bad.status < 500, `got ${bad.status}: ${bad.text.slice(0, 140)}`);
  if (bad.json?.id) orphans.push(['documents', bad.json.id]);
}

// ---------------------------------------------------------------- 6. estimates
console.log('\n=== estimates ===');
{
  const c = await req('POST', '/estimates', { lead_id: IDS.lead, notes: `${STAMP}`, line_items: [{ description: 'qa', quantity: 1, unit_price: 1 }] }, 201);
  const id = c.json?.id;
  if (id) {
    orphans.push(['estimates', id]);
    await req('GET', `/estimates/${id}`, undefined, 200, { label: '/estimates/:id' });
    const d = await req('DELETE', `/estimates/${id}`, undefined, 200, { label: '/estimates/:id' });
    if (d.ok) orphans.pop();
    await req('GET', `/estimates/${id}`, undefined, 404, { label: '/estimates/:id (after delete)' });
    await req('DELETE', `/estimates/${id}`, undefined, 404, { label: '/estimates/:id (double)' });
  }
}

// ---------------------------------------------------------------- summary
fs.writeFileSync('C:/tmp/qa-r85-lifecycle.json', JSON.stringify(rows, null, 1));
const fails = rows.filter(r => !r.ok);
const fivexx = rows.filter(r => typeof r.status === 'number' && r.status >= 500);
console.log(`\n=== SUMMARY ===\nchecks: ${rows.length} | failures: ${fails.length} | 5xx: ${fivexx.length}`);
for (const f of fails) console.log(`  FAIL ${f.method} ${f.path} -> ${f.status} (want ${f.expect}) ${f.note}`);
console.log('\nUNDELETED ROWS (need manual cleanup):', orphans.length ? JSON.stringify(orphans) : 'none');
