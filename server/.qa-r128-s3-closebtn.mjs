// Read-only: re-derive N for "close (X) button in a modal/overlay context".
// Finds every <button> whose body renders an X/XMark icon, and reports whether
// it carries the shared .modal-close / .slide-over__close class or is hand-rolled.
import fs from 'fs';
import path from 'path';

const ROOT = 'C:/Projects/stormleads/client/src';
const walk = (d, acc = []) => {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p, acc);
    else if (e.name.endsWith('.jsx')) acc.push(p);
  }
  return acc;
};

const rows = [];
for (const f of walk(ROOT)) {
  const src = fs.readFileSync(f, 'utf8');
  const lines = src.split(/\r?\n/);
  // crude but sufficient: a <button ...> ... </button> block spanning <= 8 lines
  for (let i = 0; i < lines.length; i++) {
    if (!/<button\b/.test(lines[i])) continue;
    let block = '';
    for (let j = i; j < Math.min(i + 9, lines.length); j++) {
      block += lines[j] + '\n';
      if (/<\/button>/.test(lines[j])) break;
    }
    if (!/<\/button>/.test(block)) continue;
    // does it render an X icon and nothing else meaningful?
    if (!/\b(IconX|XMarkIcon|IconXMark)\b/.test(block)) continue;
    const cls = (block.match(/className=["'{`]([^"'}`]*)/) || [])[1] || '';
    rows.push({
      site: `${path.relative(ROOT, f).replace(/\\/g, '/')}:${i + 1}`,
      cls: cls.trim() || '(none)',
      shared: /modal-close|slide-over__close/.test(cls),
      inlineBgNone: /background:\s*['"]none['"]/.test(block),
      iconSize: (block.match(/width:\s*(\d+)/) || [])[1] || null,
    });
  }
}

console.log('N close-X buttons =', rows.length);
const bad = rows.filter(r => !r.shared);
console.log('using shared class :', rows.length - bad.length);
console.log('hand-rolled        :', bad.length);
console.log(JSON.stringify(bad, null, 1));
