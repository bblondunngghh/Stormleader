// QA write-path lifecycle harness PART 2 — corrected payloads for the 3 tester-error cases
import fs from 'fs';
const BASE = 'http://localhost:3001/api';
const TOKEN = fs.readFileSync('C:/tmp/qa-token.txt', 'utf8').trim();
const rows = [];

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
  rows.push({ method, path, status, expect: exp.join('/'), ok, note: ok ? '' : (text || '').slice(0, 200) });
  console.log(`  ${ok ? '✓' : '✗'} ${method} ${path} -> ${status}${ok ? '' : ` (want ${exp.join('/')}) ${(text || '').slice(0, 160)}`}`);
  return { status, json, text, ok };
}
function check(label, cond, detail = '') {
  rows.push({ method: 'ASSERT', path: label, status: cond ? 'PASS' : 'FAIL', expect: 'PASS', ok: !!cond, note: cond ? '' : detail });
  console.log(`  ${cond ? '✓' : '✗'} ASSERT ${label}${cond ? '' : ' — ' + detail}`);
}

const stamp = 'qa20260730b';
const LEAD = 'dc8135aa-b210-4f33-bbe1-ad8f0997d3dd';

// ---- 1. tasks with the CORRECT priority enum (hot|warm|cold, shared with leads)
console.log('\n=== crm/tasks (corrected: priority=hot) ===');
const t = await req('POST', '/crm/tasks', { title: `${stamp} task`, lead_id: LEAD, due_date: '2026-08-05', priority: 'hot' }, 201);
if (t.ok && t.json?.id) {
  const id = t.json.id;
  check('tasks: create echoed title', t.json.title === `${stamp} task`, JSON.stringify(t.json).slice(0, 200));
  const p = await req('PATCH', `/crm/tasks/${id}`, { title: `${stamp} task renamed`, completed: true }, 200);
  check('tasks: patch persisted title', p.json?.title === `${stamp} task renamed`, `got ${p.json?.title}`);
  check('tasks: patch persisted completed', p.json?.completed === true, `got ${JSON.stringify(p.json?.completed)}`);
  const pBad = await req('PATCH', `/crm/tasks/${id}`, { priority: 'bogus' }, 400);
  check('tasks: bad priority enum -> 400', pBad.status === 400, `got ${pBad.status}`);
  const pEmpty = await req('PATCH', `/crm/tasks/${id}`, {}, 400);
  check('tasks: empty patch -> 400', pEmpty.status === 400, `got ${pEmpty.status}`);
  await req('DELETE', `/crm/tasks/${id}`, undefined, [200, 204]);
  const d2 = await req('DELETE', `/crm/tasks/${id}`, undefined, [404, 200]);
  check('tasks: double-delete not 5xx', d2.status < 500, `got ${d2.status}`);
}

// ---- 2. custom-fields with the CORRECT field names (field_label, not label)
console.log('\n=== crm/custom-fields (corrected: field_label) ===');
const cf = await req('POST', '/crm/custom-fields', { field_label: `${stamp} Field`, field_type: 'text' }, 201);
if (cf.ok && cf.json?.id) {
  const id = cf.json.id;
  check('custom-fields: auto-generated field_key', !!cf.json.field_key, JSON.stringify(cf.json).slice(0, 200));
  console.log('     field_key generated =', JSON.stringify(cf.json.field_key));
  const bad = await req('POST', '/crm/custom-fields', { field_label: 'x', field_type: 'bogus_type' }, 400);
  check('custom-fields: bad field_type -> 400', bad.status === 400, `got ${bad.status}`);
  // duplicate key -> should be 409 (handler maps pg 23505)
  const dup = await req('POST', '/crm/custom-fields', { field_label: `${stamp} Field`, field_type: 'text' }, [409, 201]);
  check('custom-fields: duplicate key not 5xx', dup.status < 500, `got ${dup.status} ${dup.text.slice(0, 120)}`);
  if (dup.status === 201 && dup.json?.id) await req('DELETE', `/crm/custom-fields/${dup.json.id}`, undefined, [200, 204]);
  const p = await req('PATCH', `/crm/custom-fields/${id}`, { field_label: `${stamp} Field Patched` }, 200);
  check('custom-fields: patch persisted', p.json?.field_label === `${stamp} Field Patched`, `got ${p.json?.field_label}`);
  await req('DELETE', `/crm/custom-fields/${id}`, undefined, [200, 204]);
  const d2 = await req('DELETE', `/crm/custom-fields/${id}`, undefined, [404, 200]);
  check('custom-fields: double-delete not 5xx', d2.status < 500, `got ${d2.status}`);
}

// ---- 3. leads: POST is idempotent per property. Confirm 200+alreadyExists, then
//        prove full create/patch/delete on a property that has NO lead yet.
console.log('\n=== crm/leads (idempotency + true create on a free property) ===');
const dup = await req('POST', '/crm/leads', { propertyId: 'cc1dcdc6-0def-4425-9a7c-9fa1e0b4d4a5' }, 200);
check('leads: existing property -> 200 alreadyExists (idempotent, not a dup row)',
  dup.json?.alreadyExists === true, JSON.stringify(dup.json).slice(0, 200));

// find a property with no lead
const props = await req('GET', '/properties?limit=50', undefined, 200);
const leadsList = await req('GET', '/crm/leads?limit=500', undefined, 200);
const usedProps = new Set((leadsList.json?.leads || []).map((l) => l.property_id));
const pArr = Array.isArray(props.json) ? props.json : (props.json?.properties || props.json?.data || []);
const free = pArr.find((p) => p.id && !usedProps.has(p.id));
console.log(`     properties fetched=${pArr.length}, leads=${(leadsList.json?.leads || []).length}, free property=${free ? free.id : 'NONE'}`);

if (free) {
  const c = await req('POST', '/crm/leads', { propertyId: free.id, stage: 'new', priority: 'warm', notes: `${stamp} lifecycle lead` }, [200, 201]);
  check('leads: fresh property creates a lead', !c.json?.alreadyExists && !!c.json?.id, JSON.stringify(c.json).slice(0, 200));
  if (c.json?.id && !c.json.alreadyExists) {
    const id = c.json.id;
    const g = await req('GET', `/crm/leads/${id}`, undefined, 200);
    check('leads: read-back id matches', (g.json?.id || g.json?.lead?.id) === id, JSON.stringify(g.json).slice(0, 120));
    const p = await req('PATCH', `/crm/leads/${id}`, { stage: 'contacted', notes: `${stamp} patched` }, 200);
    check('leads: patch persisted stage', p.json?.stage === 'contacted', `got ${p.json?.stage}`);
    const rt = await req('PATCH', `/crm/leads/${id}/roof-type`, { roof_type: 'asphalt_shingle' }, [200, 400]);
    check('leads/roof-type not 5xx', rt.status < 500, `got ${rt.status} ${rt.text.slice(0, 120)}`);
    const sc = await req('POST', `/crm/leads/${id}/score`, {}, [200, 201]);
    check('leads/:id/score not 5xx', sc.status < 500, `got ${sc.status} ${sc.text.slice(0, 120)}`);
    // contact sub-resource
    const ct = await req('POST', `/crm/leads/${id}/contacts`, { name: `${stamp} contact`, phone: '512-555-0199', email: 'qa2@example.com' }, [200, 201, 400]);
    if ((ct.status === 200 || ct.status === 201) && ct.json?.id) {
      const d = await req('DELETE', `/crm/leads/${id}/contacts/${ct.json.id}`, undefined, [200, 204]);
      check('leads/contacts delete ok', d.ok, `got ${d.status}`);
    }
    await req('DELETE', `/crm/leads/${id}`, undefined, [200, 204]);
    const g2 = await req('GET', `/crm/leads/${id}`, undefined, [404, 200]);
    check('leads: gone after delete (or soft-deleted)', g2.status === 404 || g2.json?.deleted_at, `got ${g2.status}`);
  }
} else {
  console.log('     (no lead-free property available — idempotency check alone stands)');
}

const fails = rows.filter((r) => !r.ok);
const fivexx = rows.filter((r) => typeof r.status === 'number' && r.status >= 500);
console.log('\n================ PART 2 SUMMARY ================');
console.log('checks:', rows.length, '| failures:', fails.length, '| 5xx:', fivexx.length);
if (fails.length) { console.log('\n--- FAILURES ---'); fails.forEach((r) => console.log(`${r.method} ${r.path} -> ${r.status} (want ${r.expect}) :: ${r.note}`)); }
fs.writeFileSync('C:/tmp/crud-part2-raw.json', JSON.stringify(rows, null, 1));
