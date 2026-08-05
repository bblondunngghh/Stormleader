import fs from 'fs';
const data = JSON.parse(fs.readFileSync('C:/tmp/r69-sweep.json', 'utf8'));
const pages = Object.keys(data);

console.log('=== auth-btn: every instance ===');
for (const p of pages) for (const b of (data[p].btnList || [])) {
  if (/auth-btn/.test(b.cn)) console.log(` ${p.padEnd(16)} "${b.t}" h=${b.h} fs=${b.fs} br=${b.br} fw=${b.fw} pad=${b.pad} bg=${b.bg} cn=${b.cn}`);
}

console.log('\n=== quick-action-btn: NON-default backgrounds (default = oklch(0.18 0.03 265 / 0.5)) ===');
for (const p of pages) for (const b of (data[p].btnList || [])) {
  if (!/quick-action-btn/.test(b.cn)) continue;
  if (b.bg === 'oklch(0.18 0.03 265 / 0.5)' || b.bg === 'oklch(0.55 0.18 250 / 0.15)') continue;
  console.log(` ${p.padEnd(16)} "${b.t}" h=${b.h} fs=${b.fs} br=${b.br} fw=${b.fw} pad=${b.pad} bg=${b.bg}`);
}

console.log('\n=== ACCENT BACKGROUND oklch(0.72 0.19 250)-family buttons (the app primary) ===');
for (const p of pages) for (const b of (data[p].btnList || [])) {
  if (!/^oklch\(0\.(72|55) 0\.(19|2) 250\)$/.test(b.bg)) continue;
  console.log(` ${p.padEnd(16)} "${b.t}" h=${b.h} fs=${b.fs} br=${b.br} fw=${b.fw} pad=${b.pad} bg=${b.bg} cn=${b.cn}`);
}

console.log('\n=== quick-action-btn height spread per page ===');
const per = {};
for (const p of pages) for (const b of (data[p].btnList || [])) {
  if (!/quick-action-btn/.test(b.cn)) continue;
  per[p] = per[p] || {};
  const k = `h=${b.h} fs=${b.fs} pad=${b.pad}`;
  per[p][k] = (per[p][k] || 0) + 1;
}
for (const [p, v] of Object.entries(per)) {
  console.log(' ' + p + ':');
  for (const [k, c] of Object.entries(v).sort((a, b) => b[1] - a[1])) console.log('    x' + c, k);
}
