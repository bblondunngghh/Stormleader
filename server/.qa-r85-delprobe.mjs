// DELETE has never been swept by any run — the write sweep filters to POST/PATCH/PUT.
// Pass 1 (this file) is the zero-risk half: every DELETE route with a DEAD uuid.
// Nothing can be destroyed because no row has that id; a 404 is the correct answer
// and a 5xx is a real bug. Also probes a malformed id to check validateId() coverage.
import fs from 'fs';
const TOKEN = fs.readFileSync('C:/tmp/qa-token.txt', 'utf8').trim();
const INV = JSON.parse(fs.readFileSync('C:/tmp/route-inventory.json', 'utf8'));
const BASE = 'http://localhost:3001';
const DEAD = '00000000-0000-4000-8000-000000000000';
const BAD = 'not-a-uuid';

// skip-trace is a paid vendor surface (charter) — its payment-method delete is not probed.
const SKIP = [/skip-trace/i];

const results = [];
for (const r of INV.filter(x => x.method === 'DELETE')) {
  if (SKIP.some(rx => rx.test(r.path))) { results.push({ ...r, variant: '-', status: 'SKIP' }); continue; }
  for (const [variant, val] of [['dead-uuid', DEAD], ['malformed-id', BAD]]) {
    const url = r.path.replace(/:([A-Za-z0-9_]+)\??/g, () => val);
    try {
      const res = await fetch(BASE + url, { method: 'DELETE', headers: { Authorization: 'Bearer ' + TOKEN } });
      const ct = res.headers.get('content-type') || '';
      const body = ct.includes('json')
        ? JSON.stringify(await res.json().catch(() => null))
        : (await res.text().catch(() => '')).slice(0, 160);
      results.push({ ...r, variant, url, status: res.status, snip: body.slice(0, 180) });
    } catch (e) { results.push({ ...r, variant, url, status: 'FETCH_ERR', snip: e.message }); }
  }
}
fs.writeFileSync('C:/tmp/qa-r85-delprobe.json', JSON.stringify(results, null, 1));
const by = {};
for (const x of results) by[x.status] = (by[x.status] || 0) + 1;
console.log('DELETE probes:', results.length, '| status:', JSON.stringify(by));

console.log('\n=== 5xx (REAL BUGS) ===');
const bad = results.filter(r => typeof r.status === 'number' && r.status >= 500);
console.log(bad.length ? '' : 'none');
for (const r of bad) console.log(`${r.status} ${r.path} [${r.variant}] ${r.snip}`);

console.log('\n=== 2xx ON A DEAD ID (claims success for a row that does not exist) ===');
const ok = results.filter(r => typeof r.status === 'number' && r.status < 300);
console.log(ok.length ? '' : 'none');
for (const r of ok) console.log(`${r.status} ${r.path} [${r.variant}] ${r.snip}`);

console.log('\n=== MALFORMED ID not rejected with 400 (validateId gap) ===');
for (const r of results.filter(x => x.variant === 'malformed-id' && x.status !== 400))
  console.log(`${String(r.status).padEnd(5)} ${r.path} :: ${r.snip}`);
