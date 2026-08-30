// Run 107 s4-verify — re-verify f9bb21e: the contracts `content` JSONB shape guard.
//
// Covers all four write paths the fix touched:
//   POST   /api/crm/contracts
//   PATCH  /api/crm/contracts/:id
//   POST   /api/crm/contracts/templates
//   PATCH  /api/crm/contracts/templates/:id
//
// DB hygiene: every bad-shape probe is expected to 400, which writes nothing. The
// happy-path probes are IDENTITY writes — PATCH sends back the row's own current
// `content` — so they exercise the full handler while leaving the stored value
// byte-identical (the Run 103 identity-merge idea, adapted to a whole-column write).
// The POST happy path is deliberately NOT run: it would create a real contract row
// on a table with no DELETE route.
import fs from 'fs';

const BASE = 'http://localhost:3001/api';
const TOKEN = fs.readFileSync('C:/tmp/qa-token.txt', 'utf8').trim();
const H = { 'Content-Type': 'application/json', Authorization: `Bearer ${TOKEN}` };

const results = [];
function log(name, pass, detail) {
  results.push({ name, pass, detail });
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}  ${detail}`);
}

async function req(method, path, body) {
  const r = await fetch(BASE + path, {
    method,
    headers: H,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let j = null;
  try { j = await r.json(); } catch { /* empty body */ }
  return { status: r.status, body: j };
}

const BAD_SHAPES = [
  ['string', 'oops'],
  ['number', 42],
  ['bool', true],
  ['array', []],
  ['sections-string', { sections: 'oops' }],
  ['sections-number', { sections: 7 }],
  ['sections-object', { sections: { a: 1 } }],
];

const main = async () => {
  // ---- fixtures: a real contract and a real template ------------------------
  const list = await req('GET', '/crm/contracts?limit=200');
  // MUST be a DRAFT row. updateContract/sendContract are scoped to draft status, so a
  // PATCH against a voided or signed contract legitimately 404s with "not found or not
  // in draft status" — which reads exactly like a broken happy path. (Run 107 harness bug.)
  const contract = (list.body?.contracts ?? []).find((c) => c.status === 'draft');
  if (!contract) { console.log('ABORT: no DRAFT contract rows to test against'); return; }

  const tpls = await req('GET', '/crm/contracts/templates');
  const tplArr = Array.isArray(tpls.body) ? tpls.body : tpls.body?.templates;
  const tpl = tplArr?.[0];

  console.log(`fixture contract ${contract.id}  template ${tpl ? tpl.id : 'NONE'}`);

  // ---- 1. POST /crm/contracts rejects every bad shape -----------------------
  for (const [label, content] of BAD_SHAPES) {
    const r = await req('POST', '/crm/contracts', { lead_id: contract.lead_id, content });
    log(`POST contracts ${label}`, r.status === 400, `${r.status} ${JSON.stringify(r.body).slice(0, 90)}`);
  }

  // ---- 2. PATCH /crm/contracts/:id rejects every bad shape ------------------
  for (const [label, content] of BAD_SHAPES) {
    const r = await req('PATCH', `/crm/contracts/${contract.id}`, { content });
    log(`PATCH contracts ${label}`, r.status === 400, `${r.status} ${JSON.stringify(r.body).slice(0, 90)}`);
  }

  // ---- 3. templates, both verbs --------------------------------------------
  for (const [label, content] of BAD_SHAPES) {
    const r = await req('POST', '/crm/contracts/templates', { name: 'qa-shape-probe', type: 'contract', content });
    log(`POST templates ${label}`, r.status === 400, `${r.status} ${JSON.stringify(r.body).slice(0, 90)}`);
  }
  if (tpl) {
    for (const [label, content] of BAD_SHAPES) {
      const r = await req('PATCH', `/crm/contracts/templates/${tpl.id}`, { content });
      log(`PATCH templates ${label}`, r.status === 400, `${r.status} ${JSON.stringify(r.body).slice(0, 90)}`);
    }
  }

  // ---- 4. HAPPY PATH — the guard must not have broken real writes -----------
  const before = await req('GET', `/crm/contracts/${contract.id}`);
  const stored = before.body?.contract?.content ?? before.body?.content ?? null;
  const identity = await req('PATCH', `/crm/contracts/${contract.id}`, { content: stored });
  log('PATCH contracts identity write', identity.status === 200, `${identity.status}`);

  const after = await req('GET', `/crm/contracts/${contract.id}`);
  const storedAfter = after.body?.contract?.content ?? after.body?.content ?? null;
  log(
    'stored content byte-identical after identity write',
    JSON.stringify(stored) === JSON.stringify(storedAfter),
    `${JSON.stringify(stored ?? null).length} chars -> ${JSON.stringify(storedAfter ?? null).length} chars`
  );

  // a well-formed sections array must still be accepted
  const good = await req('PATCH', `/crm/contracts/${contract.id}`, {
    content: { sections: Array.isArray(stored?.sections) ? stored.sections : [] },
  });
  log('PATCH contracts well-formed sections accepted', good.status === 200, `${good.status}`);
  // restore the original value so the row ends the run exactly as it started
  await req('PATCH', `/crm/contracts/${contract.id}`, { content: stored });
  const restored = await req('GET', `/crm/contracts/${contract.id}`);
  const storedRestored = restored.body?.contract?.content ?? restored.body?.content ?? null;
  log('row restored to original content', JSON.stringify(stored) === JSON.stringify(storedRestored), 'reverted');

  // ---- 5. omitted / null content must remain legal -------------------------
  // Use a WHITELISTED field (contractService.updateContract:108 allows only
  // lead_id / estimate_id / template_type / content). A body of purely unknown keys
  // produces an empty SET clause, returns null and 404s — correct, but it reads like a
  // broken happy path. Identity-write lead_id instead.
  const omitted = await req('PATCH', `/crm/contracts/${contract.id}`, { lead_id: contract.lead_id });
  log('PATCH with no content key still 200', omitted.status === 200, `${omitted.status}`);

  // ---- 6. no rows leaked ---------------------------------------------------
  const listAfter = await req('GET', '/crm/contracts?limit=200');
  const tplsAfter = await req('GET', '/crm/contracts/templates');
  const tplAfterArr = Array.isArray(tplsAfter.body) ? tplsAfter.body : tplsAfter.body?.templates;
  log('no contract rows created', (listAfter.body?.contracts?.length ?? -1) === (list.body?.total ?? listAfter.body?.contracts?.length),
    `contracts now ${listAfter.body?.contracts?.length}`);
  log('no template rows created', (tplAfterArr?.length ?? 0) === (tplArr?.length ?? 0),
    `templates ${tplArr?.length ?? 0} -> ${tplAfterArr?.length ?? 0}`);

  const failed = results.filter((r) => !r.pass);
  console.log(`\n=== ${results.length - failed.length}/${results.length} PASS ===`);
  if (failed.length) console.log(JSON.stringify(failed, null, 2));
};

main().catch((e) => console.error('HARNESS ERROR', e));
