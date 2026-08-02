// Run 65 — Axis C: query-param fuzzing on GET routes (read-only, zero DB writes).
// Garbage in a pagination/filter/date param must yield 400 or a sane 200 — never a 5xx.
import fs from 'fs';

const BASE = process.env.QA_BASE || 'http://localhost:3009';
const TOKEN = fs.readFileSync('C:/tmp/qa-token.txt', 'utf8').trim();
const routes = JSON.parse(fs.readFileSync('C:/tmp/route-inventory.json', 'utf8'));

// Only GETs with no :id param — no real ids needed, and nothing can be mutated.
const targets = routes.filter((r) => r.method === 'GET' && !/:/.test(r.path));

const FUZZ = [
  ['limit', '-1'], ['limit', 'abc'], ['limit', '99999999999'], ['limit', '0'],
  ['offset', '-5'], ['offset', 'abc'], ['page', '-1'], ['page', 'NaN'],
  ['sort', 'id;DROP TABLE leads--'], ['order', 'sideways'],
  ['start_date', 'not-a-date'], ['end_date', '0000-00-00'],
  ['startDate', '13/45/9999'], ['days', '-999'],
  ['status', "' OR 1=1--"], ['stage', '\u0000null'],
  ['lat', 'abc'], ['lng', '999'], ['bbox', '1,2,3'],
  ['q', '%'], ['search', 'a'.repeat(5000)],
];

const rows = [];
let n = 0, fivexx = 0;
for (const r of targets) {
  for (const [k, v] of FUZZ) {
    const url = `${BASE}${r.path}?${encodeURIComponent(k)}=${encodeURIComponent(v)}`;
    let status, body = '';
    try {
      const res = await fetch(url, { headers: { Authorization: `Bearer ${TOKEN}` } });
      status = res.status;
      if (status >= 500) body = (await res.text()).slice(0, 300);
    } catch (e) { status = 'ERR'; body = e.message; }
    n++;
    if (status === 'ERR' || status >= 500) {
      fivexx++;
      rows.push({ path: r.path, file: r.file, param: k, value: v.slice(0, 40), status, body });
    }
  }
}

console.log('AXIS C — QUERY-PARAM FUZZING (GET, read-only)');
console.log(`routes=${targets.length}  requests=${n}  5xx/ERR=${fivexx}`);
if (rows.length) {
  console.log('\n--- 5xx UNDER FUZZ (candidate defects) ---');
  for (const x of rows) console.log(`${x.status}\t${x.path}\t?${x.param}=${x.value}\t[${x.file}]\t${String(x.body).replace(/\s+/g, ' ').slice(0, 160)}`);
} else console.log('\nNo route returned 5xx under any fuzz value.');
fs.writeFileSync('C:/tmp/r65-fuzz.json', JSON.stringify(rows, null, 1));
