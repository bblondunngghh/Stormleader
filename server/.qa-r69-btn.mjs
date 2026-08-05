import fs from 'fs';
const data = JSON.parse(fs.readFileSync('C:/tmp/r69-sweep.json', 'utf8'));
const pages = Object.keys(data);

// classify buttons by className family
const fam = {};
for (const p of pages) {
  for (const b of (data[p].btnList || [])) {
    const key = b.cn.trim() || '(no class)';
    fam[key] = fam[key] || { n: 0, sigs: {}, pages: new Set(), ex: [] };
    fam[key].n++;
    fam[key].pages.add(p);
    const s = `h=${b.h} fs=${b.fs} br=${b.br} fw=${b.fw} pad=${b.pad} bg=${b.bg}`;
    fam[key].sigs[s] = (fam[key].sigs[s] || 0) + 1;
    if (fam[key].ex.length < 3) fam[key].ex.push(p + ':' + b.t);
  }
}
console.log('=== BUTTON FAMILIES (class -> distinct computed signatures) ===');
const sorted = Object.entries(fam).sort((a, b) => b[1].n - a[1].n);
for (const [cls, v] of sorted) {
  const nsig = Object.keys(v.sigs).length;
  const flag = nsig > 1 ? '  <<< ' + nsig + ' SIGNATURES' : '';
  console.log(`\n[${v.n}] "${cls}" pages=${v.pages.size}${flag}`);
  for (const [s, c] of Object.entries(v.sigs).sort((a, b) => b[1] - a[1])) console.log('   x' + c, s);
  if (nsig > 1) console.log('   ex:', v.ex.join(' | '));
}

console.log('\n\n=== ALL DISTINCT BORDER-RADII ON BUTTONS ===');
const radii = {};
for (const p of pages) for (const b of (data[p].btnList || [])) { radii[b.br] = radii[b.br] || new Set(); radii[b.br].add(b.cn.trim() || '(none)'); }
for (const [r, s] of Object.entries(radii).sort()) console.log(' ', r, '->', [...s].slice(0, 6).join(' | '));

console.log('\n=== PRIMARY-LOOKING BUTTONS (accent background) ===');
const bgs = {};
for (const p of pages) for (const b of (data[p].btnList || [])) {
  if (/rgba\(0, 0, 0, 0\)|transparent/.test(b.bg)) continue;
  bgs[b.bg] = bgs[b.bg] || { n: 0, ex: [] };
  bgs[b.bg].n++;
  if (bgs[b.bg].ex.length < 5) bgs[b.bg].ex.push(`${p}:"${b.t}"[${b.cn}] h=${b.h} br=${b.br}`);
}
for (const [bg, v] of Object.entries(bgs).sort((a, b) => b[1].n - a[1].n)) console.log(' n=' + v.n, bg, '\n    ', v.ex.join('\n     '));
