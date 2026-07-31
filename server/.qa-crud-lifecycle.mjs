// QA write-path lifecycle harness — overnight run 2026-07-30 (s1 api-test)
// Exercises POST/PATCH/PUT/DELETE with VALID data: create -> read back -> update -> delete -> verify gone.
// Every created row is deleted again (Neon free tier: no net row growth).
import fs from 'fs';

const BASE = 'http://localhost:3001/api';
const TOKEN = fs.readFileSync('C:/tmp/qa-token.txt', 'utf8').trim();

const FIX = {
  leadId: 'dc8135aa-b210-4f33-bbe1-ad8f0997d3dd',
  propertyId: 'cc1dcdc6-0def-4425-9a7c-9fa1e0b4d4a5',
  workOrderId: 'd93dc780-64cd-4c17-82c6-3303d138b918',
  estimateId: '1252940b-b691-4182-8d4f-680ac71a0711',
  userId: '45cc729d-cc5b-44b5-93ca-7c01b427fc26',
};

const rows = [];
const created = []; // { method:'DELETE', path } cleanup stack

async function req(method, path, body, expect) {
  const opts = {
    method,
    headers: { Authorization: `Bearer ${TOKEN}` },
  };
  if (body !== undefined) {
    opts.headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(body);
  }
  let status = 0;
  let json = null;
  let text = '';
  try {
    const res = await fetch(BASE + path, opts);
    status = res.status;
    text = await res.text();
    try { json = JSON.parse(text); } catch { json = null; }
  } catch (err) {
    text = 'FETCH_ERROR ' + err.message;
  }
  const exp = Array.isArray(expect) ? expect : [expect];
  const ok = exp.includes(status);
  rows.push({
    method, path, status,
    expect: exp.join('/'),
    ok,
    note: ok ? '' : (text || '').slice(0, 200).replace(/\s+/g, ' '),
  });
  if (!ok) console.log(`  ✗ ${method} ${path} -> ${status} (want ${exp.join('/')}) ${(text || '').slice(0, 160)}`);
  else console.log(`  ✓ ${method} ${path} -> ${status}`);
  return { status, json, text, ok };
}

function check(label, cond, detail = '') {
  rows.push({ method: 'ASSERT', path: label, status: cond ? 'PASS' : 'FAIL', expect: 'PASS', ok: !!cond, note: cond ? '' : detail });
  console.log(`  ${cond ? '✓' : '✗'} ASSERT ${label}${cond ? '' : ' — ' + detail}`);
}

// ---------------------------------------------------------------- lifecycles
async function lifecycle(name, cfg) {
  console.log(`\n=== ${name} ===`);
  // 1. missing-required-field -> 400 (never 500)
  if (cfg.badBody !== undefined) {
    const bad = await req('POST', cfg.createPath, cfg.badBody, 400);
    check(`${name}: empty/invalid body -> 400 not 5xx`, bad.status !== 500 && bad.status < 500, `got ${bad.status}`);
  }
  // 2. create with valid data
  const c = await req('POST', cfg.createPath, cfg.createBody, cfg.createExpect || 201);
  if (!c.ok || !c.json) return null;
  const id = cfg.pickId ? cfg.pickId(c.json) : c.json.id;
  check(`${name}: create returns an id`, !!id, JSON.stringify(c.json).slice(0, 160));
  if (!id) return null;
  if (cfg.deletePath) created.push({ path: cfg.deletePath(id) });

  // verify echoed fields
  if (cfg.verifyCreate) {
    for (const [k, v] of Object.entries(cfg.verifyCreate)) {
      const actual = c.json[k];
      check(`${name}: create echoed ${k}`, String(actual) === String(v), `want ${v}, got ${JSON.stringify(actual)}`);
    }
  }

  // 3. read it back
  if (cfg.getPath) {
    const g = await req('GET', cfg.getPath(id), undefined, 200);
    if (g.ok && g.json) {
      const got = cfg.pickGet ? cfg.pickGet(g.json) : g.json;
      check(`${name}: read-back id matches`, got && got.id === id, `got ${got && got.id}`);
    }
  }

  // 4. update
  if (cfg.patchBody) {
    const method = cfg.patchMethod || 'PATCH';
    const p = await req(method, cfg.patchPath ? cfg.patchPath(id) : cfg.deletePath(id), cfg.patchBody, 200);
    if (p.ok && p.json) {
      for (const [k, v] of Object.entries(cfg.verifyPatch || cfg.patchBody)) {
        if (typeof v === 'object') continue;
        const actual = p.json[k];
        check(`${name}: patch persisted ${k}`, String(actual) === String(v), `want ${v}, got ${JSON.stringify(actual)}`);
      }
    }
  }

  // 5. delete, then confirm gone
  if (cfg.deletePath) {
    const d = await req('DELETE', cfg.deletePath(id), undefined, [200, 204]);
    if (d.ok) {
      created.pop(); // successfully cleaned up
      if (cfg.getPath) {
        const g2 = await req('GET', cfg.getPath(id), undefined, [404, 200]);
        if (g2.status === 200) {
          const got = cfg.pickGet ? cfg.pickGet(g2.json) : g2.json;
          check(`${name}: gone after delete`, !got || !got.id, 'still readable after DELETE');
        } else {
          check(`${name}: gone after delete`, g2.status === 404, `got ${g2.status}`);
        }
      }
      // second delete must be 404, not 500
      const d2 = await req('DELETE', cfg.deletePath(id), undefined, [404, 200]);
      check(`${name}: double-delete is not 5xx`, d2.status < 500, `got ${d2.status}`);
    }
  }
  return id;
}

const stamp = 'qa20260730';

// ---------------------------------------------------------------- run
console.log('WRITE-PATH LIFECYCLE SWEEP — 2026-07-30');

// 1. expenses
await lifecycle('crm/expenses', {
  createPath: '/crm/expenses',
  badBody: {},
  createBody: { category: 'materials', amount: 12.34, date: '2026-07-30', notes: `${stamp} lifecycle`, lead_id: FIX.leadId },
  verifyCreate: { category: 'materials' },
  deletePath: (id) => `/crm/expenses/${id}`,
  patchBody: { notes: `${stamp} patched`, amount: 56.78 },
});

// 2. territories (PostGIS polygon)
await lifecycle('crm/territories', {
  createPath: '/crm/territories',
  badBody: { name: 'x', coordinates: [[1, 2]] }, // <3 coords
  createBody: {
    name: `${stamp} territory`,
    color: 'oklch(0.65 0.27 29)',
    coordinates: [[-97.75, 30.35], [-97.74, 30.35], [-97.74, 30.36], [-97.75, 30.36]],
    notes: 'qa',
  },
  verifyCreate: { name: `${stamp} territory` },
  getPath: (id) => `/crm/territories/${id}`,
  deletePath: (id) => `/crm/territories/${id}`,
  patchBody: { name: `${stamp} territory renamed`, notes: 'qa patched' },
});

// 3. subcontractors
const subId = await lifecycle('crm/subcontractors', {
  createPath: '/crm/subcontractors',
  badBody: {},
  createBody: { name: `${stamp} sub`, company: 'QA Roofing', phone: '512-555-0100', email: 'qa@example.com', specialty: 'roofing', hourly_rate: 45 },
  verifyCreate: { name: `${stamp} sub` },
  getPath: (id) => `/crm/subcontractors/${id}`,
  deletePath: (id) => `/crm/subcontractors/${id}`,
  patchBody: { company: 'QA Roofing Patched', specialty: 'gutters' },
});

// 4. work orders + milestones
console.log('\n=== crm/work-orders ===');
const woBad = await req('POST', '/crm/work-orders', {}, 400);
check('work-orders: no title -> 400', woBad.status === 400, `got ${woBad.status}`);
const woBadStatus = await req('POST', '/crm/work-orders', { title: 'x', status: 'bogus_status' }, 400);
check('work-orders: bad status enum -> 400', woBadStatus.status === 400, `got ${woBadStatus.status}`);
const wo = await req('POST', '/crm/work-orders', { title: `${stamp} wo`, description: 'qa', status: 'pending', lead_id: FIX.leadId }, 201);
if (wo.ok && wo.json?.id) {
  const woId = wo.json.id;
  await req('GET', `/crm/work-orders/${woId}`, undefined, 200);
  const woP = await req('PATCH', `/crm/work-orders/${woId}`, { status: 'scheduled', crew_name: 'QA Crew' }, 200);
  check('work-orders: patch status persisted', woP.json?.status === 'scheduled', `got ${woP.json?.status}`);
  // milestone sub-resource
  const msBad = await req('POST', `/crm/work-orders/${woId}/milestones`, {}, 400);
  check('work-orders/milestones: no name -> 400', msBad.status === 400, `got ${msBad.status}`);
  const ms = await req('POST', `/crm/work-orders/${woId}/milestones`, { name: `${stamp} milestone` }, 201);
  if (ms.ok && ms.json?.id) {
    const msP = await req('PATCH', `/crm/work-orders/${woId}/milestones/${ms.json.id}`, { completed: true }, 200);
    check('milestone: completed persisted', msP.status === 200, `got ${msP.status}`);
    await req('DELETE', `/crm/work-orders/${woId}/milestones/${ms.json.id}`, undefined, [200, 204]);
  }
  await req('DELETE', `/crm/work-orders/${woId}`, undefined, [200, 204]);
  await req('GET', `/crm/work-orders/${woId}`, undefined, 404);
}

// 5. automations
await lifecycle('crm/automations', {
  createPath: '/crm/automations',
  badBody: {},
  createBody: { name: `${stamp} automation`, trigger_type: 'lead_created', trigger_config: {}, action_type: 'create_task', action_config: { title: 'qa' } },
  verifyCreate: { name: `${stamp} automation` },
  deletePath: (id) => `/crm/automations/${id}`,
  patchBody: { name: `${stamp} automation renamed`, is_active: false },
});

// 5b. automation toggle (separate: needs a live row)
console.log('\n=== crm/automations toggle ===');
const auto = await req('POST', '/crm/automations', { name: `${stamp} toggle`, trigger_type: 'lead_created', action_type: 'create_task', action_config: {} }, 201);
if (auto.ok && auto.json?.id) {
  const before = auto.json.is_active;
  const t = await req('PATCH', `/crm/automations/${auto.json.id}/toggle`, {}, 200);
  check('automations/toggle flips is_active', t.json && t.json.is_active !== before, `before ${before} after ${t.json?.is_active}`);
  await req('DELETE', `/crm/automations/${auto.json.id}`, undefined, [200, 204]);
}

// 6. drip sequences
await lifecycle('crm/drip-sequences', {
  createPath: '/crm/drip-sequences',
  badBody: { name: 'x', trigger_type: 'lead_created' }, // no steps
  createBody: {
    name: `${stamp} drip`, trigger_type: 'lead_created', trigger_config: {},
    steps: [{ step_order: 1, delay_days: 1, channel: 'email', subject: 'qa', body: 'qa body' }],
  },
  verifyCreate: { name: `${stamp} drip` },
  getPath: (id) => `/crm/drip-sequences/${id}`,
  deletePath: (id) => `/crm/drip-sequences/${id}`,
  patchBody: { name: `${stamp} drip renamed` },
});

// 7. canvass pins
await lifecycle('crm/canvass-pins', {
  createPath: '/crm/canvass-pins',
  badBody: {},
  createBody: { lat: 30.355, lng: -97.745, outcome: 'not_home', notes: `${stamp}`, address: '123 QA St' },
  verifyCreate: { outcome: 'not_home' },
  deletePath: (id) => `/crm/canvass-pins/${id}`,
  patchBody: { outcome: 'interested', notes: `${stamp} patched` },
});
console.log('\n=== crm/canvass-pins enum guard ===');
const pinBadEnum = await req('POST', '/crm/canvass-pins', { lat: 30.35, lng: -97.74, outcome: 'bogus' }, 400);
check('canvass-pins: bad outcome -> 400', pinBadEnum.status === 400, `got ${pinBadEnum.status}`);

// 8. contract templates
await lifecycle('crm/contracts/templates', {
  createPath: '/crm/contracts/templates',
  badBody: {},
  createBody: { name: `${stamp} template`, type: 'roofing', body: 'QA contract body' },
  verifyCreate: { name: `${stamp} template` },
  deletePath: (id) => `/crm/contracts/templates/${id}`,
  patchBody: { name: `${stamp} template renamed` },
});

// 9. tasks
await lifecycle('crm/tasks', {
  createPath: '/crm/tasks',
  badBody: {},
  createBody: { title: `${stamp} task`, lead_id: FIX.leadId, due_date: '2026-08-05', priority: 'high' },
  verifyCreate: { title: `${stamp} task` },
  deletePath: (id) => `/crm/tasks/${id}`,
  patchBody: { title: `${stamp} task renamed`, completed: true },
});

// 10. custom fields
await lifecycle('crm/custom-fields', {
  createPath: '/crm/custom-fields',
  badBody: {},
  createBody: { name: `${stamp}_field`, label: 'QA Field', field_type: 'text', entity_type: 'lead' },
  deletePath: (id) => `/crm/custom-fields/${id}`,
  patchBody: { label: 'QA Field Patched' },
});

// 11. invoices (create needs lead_id; no DELETE route -> void via PATCH instead)
console.log('\n=== crm/invoices ===');
const invBad = await req('POST', '/crm/invoices', {}, 400);
check('invoices: no lead_id -> 400', invBad.status === 400, `got ${invBad.status}`);
const invBadUuid = await req('POST', '/crm/invoices', { lead_id: 'not-a-uuid' }, 400);
check('invoices: bad lead_id uuid -> 400', invBadUuid.status === 400, `got ${invBadUuid.status}`);
const inv = await req('POST', '/crm/invoices', { lead_id: FIX.leadId, line_items: [{ description: 'qa', quantity: 1, unit_price: 100 }], notes: stamp }, 201);
if (inv.ok && inv.json?.id) {
  const invId = inv.json.id;
  await req('GET', `/crm/invoices/${invId}`, undefined, 200);
  const invBadStatus = await req('PATCH', `/crm/invoices/${invId}`, { status: 'bogus' }, 400);
  check('invoices: bad status enum -> 400', invBadStatus.status === 400, `got ${invBadStatus.status}`);
  const payBad = await req('POST', `/crm/invoices/${invId}/payment`, { amount: 0 }, 400);
  check('invoices/payment: amount 0 -> 400', payBad.status === 400, `got ${payBad.status}`);
  const pay = await req('POST', `/crm/invoices/${invId}/payment`, { amount: 25, method: 'check' }, [200, 201]);
  check('invoices/payment: valid amount accepted', pay.ok, `got ${pay.status}`);
  await req('PATCH', `/crm/invoices/${invId}`, { status: 'void', notes: `${stamp} voided by QA` }, 200);
}

// 12. leads create/patch/delete
await lifecycle('crm/leads', {
  createPath: '/crm/leads',
  badBody: {},
  createBody: { propertyId: FIX.propertyId, stage: 'new', priority: 'warm', notes: `${stamp} lifecycle lead` },
  getPath: (id) => `/crm/leads/${id}`,
  deletePath: (id) => `/crm/leads/${id}`,
  patchBody: { stage: 'contacted', notes: `${stamp} patched lead` },
});

// 13. activities (append-only, no delete route)
console.log('\n=== crm/activities ===');
const actBad = await req('POST', '/crm/activities', {}, 400);
check('activities: empty body -> 400 not 5xx', actBad.status < 500, `got ${actBad.status}`);

// 14. estimates
await lifecycle('estimates', {
  createPath: '/estimates',
  badBody: {},
  createBody: { lead_id: FIX.leadId, customer_name: `${stamp} customer`, line_items: [{ description: 'qa shingles', quantity: 10, unit_price: 5 }], notes: stamp },
  getPath: (id) => `/estimates/${id}`,
  deletePath: (id) => `/estimates/${id}`,
  patchBody: { customer_name: `${stamp} customer patched` },
});

// 15. alerts config (PUT, singleton — read/restore, do not destroy)
console.log('\n=== alerts config (PUT singleton) ===');
const alertGet = await req('GET', '/alerts/config', undefined, 200);
if (alertGet.ok) {
  const orig = alertGet.json;
  const put = await req('PUT', '/alerts/config', { ...orig, min_hail_size: 1.25 }, 200);
  check('alerts/config PUT accepted', put.ok, `got ${put.status}`);
  // restore original
  if (orig && typeof orig === 'object') await req('PUT', '/alerts/config', orig, 200);
}

// 16. notifications mark-read (PATCH, non-destructive)
console.log('\n=== notifications ===');
const notif = await req('GET', '/notifications', undefined, 200);
const list = notif.json?.notifications || notif.json || [];
if (Array.isArray(list) && list.length) {
  const nid = list[0].id;
  const nr = await req('PATCH', `/notifications/${nid}/read`, {}, [200, 204]);
  check('notifications/:id/read accepted', nr.ok, `got ${nr.status}`);
} else {
  console.log('  (no notifications to mark read)');
}

// ---------------------------------------------------------------- cleanup
if (created.length) {
  console.log('\n=== CLEANUP of rows left behind ===');
  for (const c of created.reverse()) {
    await req('DELETE', c.path, undefined, [200, 204, 404]);
  }
}

// ---------------------------------------------------------------- report
const fails = rows.filter((r) => !r.ok);
const fivexx = rows.filter((r) => typeof r.status === 'number' && r.status >= 500);
console.log('\n================ SUMMARY ================');
console.log('total checks:', rows.length);
console.log('failures    :', fails.length);
console.log('5xx         :', fivexx.length);
if (fivexx.length) {
  console.log('\n--- 5xx (REAL BUGS) ---');
  fivexx.forEach((r) => console.log(`${r.method} ${r.path} -> ${r.status} :: ${r.note}`));
}
if (fails.length) {
  console.log('\n--- ALL FAILURES ---');
  fails.forEach((r) => console.log(`${r.method} ${r.path} -> ${r.status} (want ${r.expect}) :: ${r.note}`));
}
fs.writeFileSync('C:/tmp/crud-lifecycle-raw.json', JSON.stringify(rows, null, 1));
