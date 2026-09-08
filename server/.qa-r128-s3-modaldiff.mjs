// Read-only static diff of the app's 22 .modal-backdrop overlay sites.
// For each, report the panel element, its radius/padding, the first heading
// tag + fontSize/fontWeight, and whether a .modal-close button is present.
import fs from 'fs';
import path from 'path';

const ROOT = 'C:/Projects/stormleads/client/src/components';
const files = fs.readdirSync(ROOT).filter(f => f.endsWith('.jsx'));
const rows = [];

for (const f of files) {
  const src = fs.readFileSync(path.join(ROOT, f), 'utf8');
  const lines = src.split(/\r?\n/);
  lines.forEach((ln, i) => {
    if (!ln.includes('modal-backdrop')) return;
    const win = lines.slice(i, i + 45).join('\n');
    // panel: first className containing glass after the backdrop
    const pm = win.match(/<(div|form)\b[^>]*className="([^"]*\bglass\b[^"]*)"/);
    const panelCls = pm ? pm[2] : null;
    // panel style literal: take the style={{ ... }} that follows the panel tag
    let panelStyle = null;
    if (pm) {
      const after = win.slice(win.indexOf(pm[0]));
      const sm = after.match(/style=\{\{([\s\S]*?)\}\}/);
      if (sm) panelStyle = sm[1].replace(/\s+/g, ' ').trim();
    }
    const pick = (k) => {
      if (!panelStyle) return null;
      const m = panelStyle.match(new RegExp(k + ":\\s*([^,]+)"));
      return m ? m[1].trim() : null;
    };
    const hm = win.match(/<(h[1-6])\b([^>]*)>/);
    let hFs = null, hFw = null;
    if (hm) {
      const hs = win.slice(win.indexOf(hm[0])).match(/style=\{\{([\s\S]*?)\}\}/);
      if (hs) {
        const s = hs[1].replace(/\s+/g, ' ');
        hFs = (s.match(/fontSize:\s*([^,}]+)/) || [])[1];
        hFw = (s.match(/fontWeight:\s*([^,}]+)/) || [])[1];
      }
    }
    rows.push({
      site: `${f}:${i + 1}`,
      panel: panelCls,
      width: pick('width'),
      maxWidth: pick('maxWidth'),
      maxHeight: pick('maxHeight'),
      radius: pick('borderRadius'),
      padding: pick('padding'),
      overflow: pick('overflow'),
      heading: hm ? hm[1] : null,
      hFs: hFs ? hFs.trim() : null,
      hFw: hFw ? hFw.trim() : null,
      modalClose: /className="modal-close"|className=\{`?modal-close/.test(win),
    });
  });
}

const tally = (k) => {
  const c = {};
  rows.forEach(r => { const v = String(r[k]); c[v] = (c[v] || 0) + 1; });
  return c;
};

console.log('N =', rows.length);
console.log(JSON.stringify(rows, null, 1));
console.log('\n--- tallies ---');
for (const k of ['panel', 'radius', 'padding', 'overflow', 'maxHeight', 'heading', 'hFs', 'hFw', 'modalClose']) {
  console.log(k, JSON.stringify(tally(k)));
}
