// Run 128 (s2-frontend-test) — SAVE/HYDRATE ROUND-TRIP GAP
//
// Run 126's `25edc26` defect: EstimateBuilder SENT `footer_notes` in its payload but never
// HYDRATED it back off the loaded estimate, so the editor opened blank on an estimate that
// already had footer notes — and the next save wrote that blank over them. Silent data loss
// with no error, invisible to every rendering check because a blank field renders fine.
//
// The general shape is a set difference per component file:
//     { snake_case keys the file SENDS in a save payload }
//   - { snake_case field names the file READS back off a loaded entity }
//
// A key that is only ever written and never read is a field the editor cannot show you,
// which means it is a field the editor will overwrite with its default.
//
// Read-only. `node .qa-r128-s2-roundtrip.mjs <walkRoot>`; `--selftest` asserts the check
// rediscovers the proven 25edc26 defect from the pre-fix tree.
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const ROOT = process.argv[2] || 'C:/Projects/stormleads/client/src';

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/\.jsx?$/.test(e.name)) out.push(p);
  }
  return out;
}

// Comments only — never track quotes across JSX text (Run 86).
function stripComments(src) {
  const a = src.split('');
  let i = 0;
  while (i < src.length - 1) {
    if (src[i] === '/' && src[i + 1] === '/') { while (i < src.length && src[i] !== '\n') { a[i] = ' '; i++; } }
    else if (src[i] === '/' && src[i + 1] === '*') {
      while (i < src.length && !(src[i] === '*' && src[i + 1] === '/')) { if (src[i] !== '\n') a[i] = ' '; i++; }
      a[i] = ' '; a[i + 1] = ' '; i += 2;
    } else i++;
  }
  return a.join('');
}

// A snake_case key written as an object property in a payload-ish literal.
// `foo_bar:` or `'foo_bar':` at the start of a property.
// The leading class must exclude every identifier char AND `.`, or `stats.draft_value :`
// in a ternary yields the phantom key `ft_value`.
const SENT = /(?:^|[^\w$.])(?:'([a-z][a-z0-9]*(?:_[a-z0-9]+)+)'|"([a-z][a-z0-9]*(?:_[a-z0-9]+)+)"|([a-z][a-z0-9]*(?:_[a-z0-9]+)+))\s*:(?!:)/gm;

// Only look at files that actually perform a write, and only at the regions around one.
const WRITE = /\b(?:client\.(?:post|put|patch)|[A-Za-z_$][\w$]*Api\.(?:create|update|save|send|add)[A-Za-z_$]*)\s*\(/g;

function payloadRegions(src) {
  const regions = [];
  let m;
  WRITE.lastIndex = 0;
  while ((m = WRITE.exec(src))) {
    // the payload is usually the literal on this line or the `const payload = {...}` just above
    // Snap to line boundaries. A raw offset slice can cut mid-identifier, and the `m`
    // flag then lets `^` match the fragment: `stats.draft_value` sliced at the `a`
    // yielded the phantom key `ft_value`.
    let from = Math.max(0, m.index - 1200);
    let to = Math.min(src.length, m.index + 1200);
    from = src.lastIndexOf('\n', from) + 1;
    const nl = src.indexOf('\n', to);
    to = nl === -1 ? src.length : nl;
    regions.push(src.slice(from, to));
  }
  return regions;
}

function analyse(files) {
  const findings = [];
  for (const f of files) {
    const src = stripComments(fs.readFileSync(f, 'utf8'));
    const regions = payloadRegions(src);
    if (!regions.length) continue;

    const sent = new Set();
    for (const r of regions) {
      SENT.lastIndex = 0;
      let m;
      while ((m = SENT.exec(r))) sent.add(m[1] || m[2] || m[3]);
    }
    if (!sent.size) continue;

    const gaps = [];
    for (const k of sent) {
      // Is the key ever READ back off some object? `<expr>.<key>` or `['<key>']`.
      const readBack = new RegExp(`\\.\\s*${k}\\b|\\[\\s*['"\`]${k}['"\`]\\s*\\]`).test(src);
      if (!readBack) gaps.push(k);
    }
    if (gaps.length) {
      findings.push({ file: path.relative(ROOT, f).replace(/\\/g, '/'), sent: sent.size, gaps: gaps.sort() });
    }
  }
  return findings;
}

if (process.argv.includes('--selftest')) {
  const dir = 'C:/tmp/qa-r128-rt-selftest';
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  // Pull the REAL pre-fix file for the proven 25edc26 defect (footer_notes sent, never hydrated).
  try {
    const pre = execSync('git -C C:/Projects/stormleads show 25edc26~1:client/src/components/EstimatesView.jsx', { maxBuffer: 1 << 26 }).toString();
    fs.writeFileSync(path.join(dir, 'EstimatesView.jsx'), pre);
  } catch (e) { console.log('could not fetch pre-fix tree:', e.message); process.exit(2); }
  // Negative control: sends a key and reads it straight back.
  fs.writeFileSync(path.join(dir, 'Negative.jsx'), [
    'function A(){ const [t,setT]=useState("");',
    '  useEffect(()=>{ setT(row.due_date || ""); },[row]);',
    '  return tasksApi.updateTask(id, { due_date: t, title: "x" }); }',
  ].join('\n'));
  const r = analyse(walk(dir));
  const pos = r.find(x => x.file.includes('EstimatesView'));
  const hit = !!pos && pos.gaps.includes('footer_notes');
  const neg = r.find(x => x.file.includes('Negative'));
  console.log('SELFTEST rediscovers 25edc26 (footer_notes):', hit, '| negative silent:', !neg);
  if (pos) console.log('  pre-fix gaps:', pos.gaps.join(', '));
  if (neg) console.log('  NEGATIVE LEAKED:', neg.gaps.join(', '));
  process.exit(hit && !neg ? 0 : 1);
}

const files = walk(ROOT);
const r = analyse(files);
console.log(`files=${files.length} filesWithGaps=${r.length}`);
for (const f of r) console.log(`\n${f.file}  (sends ${f.sent} snake_case keys)\n  NEVER READ BACK: ${f.gaps.join(', ')}`);
