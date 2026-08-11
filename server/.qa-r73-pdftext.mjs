// Run 73 s1 — extract visible text from a contract PDF. A 200 is not proof the
// content rendered; the plain-text fallback must actually reach the page.
import zlib from 'zlib';
import { req, mint, BASE, currentToken } from './.qa-r73-lib.mjs';

await mint();
const id = process.argv[2] || 'bb979c43-4371-460b-b6fc-db8a7b730451';
const r = await fetch(`${BASE}/api/crm/contracts/${id}/pdf`, {
  headers: { Authorization: `Bearer ${currentToken()}` },
});
const buf = Buffer.from(await r.arrayBuffer());

let raw = '';
let i = 0;
while ((i = buf.indexOf('stream', i)) !== -1) {
  let s = i + 6;
  while (buf[s] === 13 || buf[s] === 10) s++;
  const e = buf.indexOf('endstream', s);
  if (e === -1) break;
  try { raw += zlib.inflateSync(buf.subarray(s, e)).toString('latin1'); } catch { /* not flate */ }
  i = e + 9;
}

const shown = [...raw.matchAll(/\(((?:[^()\\]|\\.)*)\)/g)].map(m => m[1]).join(' ');
console.log(`status ${r.status}, ${buf.length} bytes`);
console.log('visible text:', shown.slice(0, 500));
console.log('');
console.log('contains "Test contract body"?',
  /Test contract body/.test(shown) ? 'YES — plain-text content preserved' : 'NO — CONTENT DROPPED');
