/**
 * Run 105 (s1 api-test) — TYPE CONFUSION ON WHITELISTED FIELDS.
 *
 * The Run 100 sweep's phases D/E only ever sent an *unknown* field, so a handler
 * that whitelists a field and then pushes its value into SQL with no type check has
 * never been exercised. That is the open "a value silently loses its expected type"
 * branch. A wrong type on a typed column raises 22P02/22007 -> 500, where the
 * correct answer is 400.
 *
 * SAFETY: every target is snapshotted first and restored at the end; the probe
 * values are all wrong-typed, so a correct handler rejects them and writes nothing.
 */
import fs from 'fs';

const BASE = 'http://localhost:3001';
const TOKEN = fs.readFileSync('C:/tmp/qa-token.txt', 'utf8').trim();
const H = { 'Content-Type': 'application/json', Authorization: `Bearer ${TOKEN}` };

async function req(method, path, body) {
  const r = await fetch(BASE + path, {
    method, headers: H, body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await r.text();
  let json = null; try { json = JSON.parse(text); } catch { /* non-JSON */ }
  return { status: r.status, json, text: text.slice(0, 200) };
}

// Wrong-typed values, one per plausible column type.
const WRONG = [
  ['string-for-number', 'abc'],
  ['object-for-scalar', { a: 1 }],
  ['array-for-scalar', [1, 2]],
  ['bool-for-number', true],
  ['number-for-bool', 7],
];

const TARGETS = [
  {
    name: 'alerts/config',
    get: '/api/alerts/config',
    put: ['PUT', '/api/alerts/config'],
    fields: ['enabled', 'email_enabled', 'email_recipients',
      'min_hail_size_in', 'min_wind_speed_mph', 'alert_mode', 'digest_hour'],
  },
  {
    name: 'crm/tenant-settings',
    get: '/api/crm/tenant-settings',
    put: ['PUT', '/api/crm/tenant-settings'],
    fields: null, // discovered from the GET below
  },
];

const results = [];
const defects = [];

async function main() {
  for (const t of TARGETS) {
    const before = await req('GET', t.get);
    const snapshot = before.json?.config || before.json?.settings || before.json || {};
    const fields = t.fields || Object.keys(snapshot).filter(
      k => !/^(id|tenant_id|created_at|updated_at)$/.test(k)
    );
    console.log(`\n===== ${t.name} (${fields.length} fields) =====`);

    for (const f of fields) {
      for (const [label, val] of WRONG) {
        const r = await req(t.put[0], t.put[1], { [f]: val });
        const row = { target: t.name, field: f, probe: label, status: r.status, body: r.text.slice(0, 120) };
        results.push(row);
        if (r.status >= 500) {
          defects.push(row);
          console.log(`  *** 500 *** ${f} <- ${label}  ${r.text.slice(0, 110)}`);
        }
      }
    }

    // restore every field we may have successfully written
    const restore = {};
    for (const f of fields) if (snapshot[f] !== undefined) restore[f] = snapshot[f];
    if (Object.keys(restore).length) {
      const rr = await req(t.put[0], t.put[1], restore);
      console.log(`  restore -> ${rr.status}`);
    }
    const after = await req('GET', t.get);
    const a = JSON.stringify(after.json?.config || after.json?.settings || after.json || {});
    console.log(`  snapshot restored identical? ${a === JSON.stringify(snapshot)}`);
  }

  fs.writeFileSync('C:/tmp/qa-r105-typed.json', JSON.stringify({ results, defects }, null, 1));
  const byStatus = {};
  for (const r of results) byStatus[r.status] = (byStatus[r.status] || 0) + 1;
  console.log(`\n=== ${results.length} probes | ${JSON.stringify(byStatus)} | 5xx defects: ${defects.length} ===`);
}

main().catch(e => { console.error('HARNESS ERROR', e); process.exit(1); });
