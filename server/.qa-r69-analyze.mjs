import fs from 'fs';

const raw = fs.readFileSync(process.argv[2], 'utf8');
const start = raw.indexOf('"{');
// find the JSON string literal (it is JSON-escaped) up to the closing quote at line end
const line = raw.slice(start);
const end = line.lastIndexOf('}"');
const jsonStr = JSON.parse(line.slice(0, end + 2));
const data = JSON.parse(jsonStr);
fs.writeFileSync('C:/tmp/r69-sweep.json', JSON.stringify(data, null, 1));

const pages = Object.keys(data);
console.log('PAGES:', pages.length, pages.join(', '));
console.log('\n=== ERRORS ===');
for (const p of pages) if (data[p].error) console.log(p, data[p].error);

console.log('\n=== AXIS 1: ICONS ===');
const allSizes = {}, allStrokes = {}; let badTotal = 0;
for (const p of pages) {
  const d = data[p]; if (!d.icons) continue;
  for (const [k, v] of Object.entries(d.icons.sizes)) allSizes[k] = (allSizes[k] || 0) + v;
  for (const [k, v] of Object.entries(d.icons.strokes)) allStrokes[k] = (allStrokes[k] || 0) + v;
  if (d.icons.bad.length) { badTotal += d.icons.bad.length; console.log(' NON-24x24 on', p, JSON.stringify(d.icons.bad.slice(0, 5))); }
}
console.log(' bad viewBox total:', badTotal);
console.log(' sizes:', JSON.stringify(allSizes));
console.log(' strokes:', JSON.stringify(allStrokes));

console.log('\n=== AXIS 3: HEADERS ===');
const hsig = {};
for (const p of pages) { const h = data[p].header; if (!h) { console.log(' NO TOPBAR:', p); continue; }
  const s = JSON.stringify({ h: h.h, pad: h.pad, cls: h.cls, bg: h.bg, fs: h.h1?.fs, fw: h.h1?.fw, hasH1: !!h.h1 });
  (hsig[s] = hsig[s] || []).push(p + '(' + h.acts + ' acts)'); }
for (const [s, ps] of Object.entries(hsig)) console.log(' ', s, '->', ps.join(', '));

console.log('\n=== AXIS 5: FORMS ===');
for (const p of pages) { const f = data[p].form; if (!f) continue;
  if (f.nativeSelect || f.nativeDate) console.log(' NATIVE VIOLATION', p, 'select=' + f.nativeSelect, 'date=' + f.nativeDate); }
const inpSig = {};
for (const p of pages) { const f = data[p].form; if (!f) continue;
  for (const [k, v] of Object.entries(f.inputs)) { inpSig[k] = inpSig[k] || { n: 0, pages: new Set() }; inpSig[k].n += v; inpSig[k].pages.add(p); } }
console.log(' input signatures:', Object.keys(inpSig).length);
for (const [k, v] of Object.entries(inpSig).sort((a, b) => b[1].n - a[1].n)) console.log('  n=' + v.n, k, '[' + [...v.pages].join(',') + ']');
const labSig = {};
for (const p of pages) { const f = data[p].form; if (!f) continue;
  for (const [k, v] of Object.entries(f.labels)) { labSig[k] = labSig[k] || { n: 0, pages: new Set() }; labSig[k].n += v; labSig[k].pages.add(p); } }
console.log(' label signatures:', Object.keys(labSig).length);
for (const [k, v] of Object.entries(labSig).sort((a, b) => b[1].n - a[1].n)) console.log('  n=' + v.n, k, '[' + [...v.pages].join(',') + ']');

console.log('\n=== AXIS 6: GLASS / SCROLL ===');
const gSig = {};
for (const p of pages) { const g = data[p].glass; if (!g) continue;
  for (const [k, v] of Object.entries(g)) { gSig[k] = gSig[k] || { n: 0, pages: new Set() }; gSig[k].n += v; gSig[k].pages.add(p); } }
for (const [k, v] of Object.entries(gSig).sort((a, b) => b[1].n - a[1].n)) console.log('  n=' + v.n, k, '[' + [...v.pages].join(',') + ']');
for (const p of pages) { const s = data[p].scroll; if (s && s.sw !== s.cw) console.log(' H-SCROLL', p, JSON.stringify(s)); }

console.log('\n=== NEW AXIS: TEXT OVERFLOW (clipped/unclipped) ===');
for (const p of pages) { const o = data[p].overflow; if (o && o.length) console.log(' ', p, JSON.stringify(o)); }
