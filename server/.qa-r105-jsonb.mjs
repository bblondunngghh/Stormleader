/**
 * Run 105 (s1 api-test) — sweep the jsonb write sites that Run 104 left unswept,
 * plus the tasks.priority enum path that no stage had ever been assigned.
 *
 * Charter: mutate-then-revert only. Creates no rows it does not delete, and
 * every accepted bad shape is followed by a READ of every consumer endpoint —
 * the Run 68 lesson is that a 2xx write is not evidence the stored value is usable.
 */
import fs from 'fs';

const BASE = 'http://localhost:3001';
const TOKEN = fs.readFileSync('C:/tmp/qa-token.txt', 'utf8').trim();

const H = { 'Content-Type': 'application/json', Authorization: `Bearer ${TOKEN}` };

async function req(method, path, body) {
  const r = await fetch(BASE + path, {
    method,
    headers: H,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await r.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* non-JSON body */ }
  return { status: r.status, json, text: text.slice(0, 300) };
}

const results = [];
function rec(check, method, path, sent, r, note) {
  results.push({ check, method, path, sent, status: r.status, note, body: r.text.slice(0, 160) });
  console.log(
    `[${check}] ${method} ${path} sent=${JSON.stringify(sent)} -> ${r.status} ${note || ''}`
  );
}

// Scalars a client could plausibly send where an object/array is expected.
const BAD = [
  ['string', 'oops'],
  ['number', 42],
  ['bool', true],
  ['array', [1, 2]],
];

async function main() {
  // ---- resolve real ids -------------------------------------------------
  const contracts = await req('GET', '/api/crm/contracts?limit=5');
  const drips = await req('GET', '/api/crm/drip-sequences');
  const invoices = await req('GET', '/api/crm/invoices?limit=5');
  const wos = await req('GET', '/api/crm/work-orders?limit=5');

  const pick = (r, ...keys) => {
    let d = r.json;
    for (const k of keys) d = d?.[k] ?? d;
    return Array.isArray(d) ? d[0] : Array.isArray(d?.rows) ? d.rows[0] : null;
  };

  // PATCH /crm/contracts/:id is draft-only (404 "not in draft status" otherwise),
  // so a naive [0] pick lands on a voided row and every probe 404s before the
  // handler logic runs — the Run 74 dead-uuid trap in another costume.
  const contract = (contracts.json?.contracts || []).find(c => c.status === 'draft');
  let drip = pick(drips, 'sequences');
  let dripIsOurs = false;
  const invoice = pick(invoices, 'invoices');
  const wo = pick(wos, 'workOrders', 'work_orders');

  console.log('ids:', {
    contract: contract?.id, drip: drip?.id, invoice: invoice?.id, wo: wo?.id,
  });
  console.log('list shapes:', {
    contracts: Object.keys(contracts.json || {}),
    drips: Object.keys(drips.json || {}),
    invoices: Object.keys(invoices.json || {}),
    wos: Object.keys(wos.json || {}),
  });

  // ---- CHECK A: contracts.content (NO route guard found) ----------------
  if (contract) {
    const original = contract.content;
    for (const [label, val] of BAD) {
      const r = await req('PATCH', `/api/crm/contracts/${contract.id}`, { content: val });
      rec('A-contract-content', 'PATCH', `/crm/contracts/:id`, label, r,
        r.status === 400 ? 'REJECTED(good)' : 'ACCEPTED<-- check consumers');

      if (r.status < 300) {
        // A 2xx is not enough. Hit every consumer of contracts.content.
        const g = await req('GET', `/api/crm/contracts/${contract.id}`);
        rec('A-consumer-get', 'GET', '/crm/contracts/:id', label, g,
          g.status >= 500 ? '*** 500 CRASH ***' : '');
        const p = await req('GET', `/api/crm/contracts/${contract.id}/pdf`);
        rec('A-consumer-pdf', 'GET', '/crm/contracts/:id/pdf', label, p,
          p.status >= 500 ? '*** 500 CRASH ***' : '');
        const l = await req('GET', '/api/crm/contracts?limit=5');
        rec('A-consumer-list', 'GET', '/crm/contracts', label, l,
          l.status >= 500 ? '*** 500 CRASH ***' : '');
        // revert immediately
        await req('PATCH', `/api/crm/contracts/${contract.id}`, { content: original });
      }
    }
    const back = await req('GET', `/api/crm/contracts/${contract.id}`);
    const restored = JSON.stringify(back.json?.contract?.content ?? back.json?.content);
    console.log('A revert ok?', restored === JSON.stringify(original), restored?.slice(0, 80));
  }

  // The tenant has no drip sequences, so B has nothing to PATCH. drip_sequences
  // HAS a DELETE route, so create-then-delete is safe here (net 0 rows).
  if (!drip) {
    const c = await req('POST', '/api/crm/drip-sequences', {
      name: 'QA-R105 probe', trigger_type: 'lead_created', trigger_config: { source: 'qa' },
      steps: [{ step_order: 1, delay_days: 1, channel: 'email', subject: 'x', body: 'y' }],
    });
    console.log('drip create ->', c.status, c.text.slice(0, 200));
    drip = c.json?.sequence || c.json;
    dripIsOurs = !!drip?.id;
  }

  // ---- CHECK B: drip_sequences.trigger_config (NO route guard found) -----
  if (drip?.id) {
    const original = drip.trigger_config;
    for (const [label, val] of BAD) {
      const r = await req('PATCH', `/api/crm/drip-sequences/${drip.id}`, { trigger_config: val });
      rec('B-drip-triggercfg', 'PATCH', '/crm/drip-sequences/:id', label, r,
        r.status === 400 ? 'REJECTED(good)' : 'ACCEPTED<-- check consumers');
      if (r.status < 300) {
        const g = await req('GET', `/api/crm/drip-sequences/${drip.id}`);
        rec('B-consumer-get', 'GET', '/crm/drip-sequences/:id', label, g,
          g.status >= 500 ? '*** 500 CRASH ***' : '');
        const l = await req('GET', '/api/crm/drip-sequences');
        rec('B-consumer-list', 'GET', '/crm/drip-sequences', label, l,
          l.status >= 500 ? '*** 500 CRASH ***' : '');
        await req('PATCH', `/api/crm/drip-sequences/${drip.id}`, { trigger_config: original });
      }
    }
  }

  if (dripIsOurs && drip?.id) {
    const d = await req('DELETE', `/api/crm/drip-sequences/${drip.id}`);
    console.log('drip cleanup ->', d.status);
  }

  // ---- CHECK C: regression — invoices/work-orders line_items guards ------
  if (invoice) {
    for (const [label, val] of BAD.slice(0, 3)) {
      const r = await req('PATCH', `/api/crm/invoices/${invoice.id}`, { line_items: val });
      rec('C-invoice-lineitems', 'PATCH', '/crm/invoices/:id', label, r,
        r.status === 400 ? 'REJECTED(good)' : 'REGRESSION<-- guard gone');
    }
  }
  if (wo) {
    for (const [label, val] of BAD.slice(0, 3)) {
      const r = await req('PATCH', `/api/crm/work-orders/${wo.id}`, { line_items: val });
      rec('C-wo-lineitems', 'PATCH', '/crm/work-orders/:id', label, r,
        r.status === 400 ? 'REJECTED(good)' : 'REGRESSION<-- guard gone');
    }
  }

  // ---- CHECK D: tasks.priority enum (crmService passes it through raw) ---
  // lead_priority enum is hot|warm|cold. AutomationSettings offers low/medium/
  // high/urgent. A raw pass-through should raise 22P02 -> 500 rather than 400.
  for (const p of ['urgent', 'high', 'medium', 'low', 'bogus']) {
    const r = await req('POST', '/api/crm/tasks', { title: `QA-R105 priority ${p}`, priority: p });
    rec('D-task-priority', 'POST', '/crm/tasks', p, r,
      r.status >= 500 ? '*** 500 CRASH (22P02) ***'
        : r.status === 400 ? 'REJECTED(good)'
          : 'ACCEPTED<-- row created, needs cleanup');
    if (r.status < 300) {
      const id = r.json?.task?.id || r.json?.id;
      if (id) { await req('DELETE', `/api/crm/tasks/${id}`); console.log('   cleanup attempted for', id); }
    }
  }

  fs.writeFileSync('C:/tmp/qa-r105-jsonb.json', JSON.stringify(results, null, 2));
  const bad = results.filter(x => x.status >= 500 || /REGRESSION|ACCEPTED/.test(x.note || ''));
  console.log(`\n=== ${results.length} probes, ${bad.length} needing triage ===`);
}

main().catch(e => { console.error('HARNESS ERROR', e); process.exit(1); });
