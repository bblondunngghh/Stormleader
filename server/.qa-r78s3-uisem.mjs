// Run 78 s3 — UI semantic set-differences (NEW name kinds; the className/CSS-var/keyframes
// vein was exhausted in Run 77). Three checks:
//   A. icon component rendered inside a control  vs  the ACTION that control performs
//      (title / aria-label / inner text / onClick handler name)
//   B. data-* attributes SET in JSX  vs  data-* attributes QUERIED in JS/CSS
//   C. controls that are icon-only with NO accessible name at all
// Reads only; writes JSON to stdout.
import fs from 'fs';
import path from 'path';

const SRC = 'C:/Projects/stormleads/client/src';

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (!/node_modules|assets/.test(e.name)) walk(p, out); }
    else if (/\.(jsx|js)$/.test(e.name) && !/\.backup$/.test(e.name)) out.push(p);
  }
  return out;
}
const files = walk(SRC);

// ---------- semantic buckets ----------
// action keyword -> canonical intent
const ACTION = [
  [/\b(delete|remove|trash|discard)\b/i, 'delete'],
  [/\b(edit|rename|modify)\b/i, 'edit'],
  [/\b(add|new|create)\b/i, 'add'],
  [/\b(save|apply|confirm|submit)\b/i, 'save'],
  [/\b(download|export)\b/i, 'download'],
  [/\b(upload|import)\b/i, 'upload'],
  [/\b(send|email|mail)\b/i, 'send'],
  [/\b(print)\b/i, 'print'],
  [/\b(duplicate|copy|clone)\b/i, 'copy'],
  [/\b(search|find|filter)\b/i, 'search'],
  [/\b(close|dismiss|cancel)\b/i, 'close'],
  [/\b(view|preview|open|show|details)\b/i, 'view'],
  [/\b(refresh|reload|sync|retry)\b/i, 'refresh'],
  [/\b(call|phone|dial)\b/i, 'call'],
  [/\b(settings|configure|preferences)\b/i, 'settings'],
];
// icon component -> intent(s) it legitimately conveys
const ICON = {
  Trash: ['delete'], XMark: ['close', 'delete'], XCircle: ['close', 'delete'], Minus: ['delete'],
  Pencil: ['edit'], PencilSquare: ['edit'],
  Plus: ['add'], PlusCircle: ['add'],
  Check: ['save'], CheckCircle: ['save'], DocumentCheck: ['save'],
  ArrowDownTray: ['download'], ArrowUpTray: ['upload'], CloudArrowUp: ['upload'], CloudArrowDown: ['download'],
  PaperAirplane: ['send'], Envelope: ['send'],
  Printer: ['print'],
  DocumentDuplicate: ['copy'], Clipboard: ['copy'], ClipboardDocument: ['copy'], Square2Stack: ['copy'],
  MagnifyingGlass: ['search'], Funnel: ['search'], AdjustmentsHorizontal: ['search', 'settings'],
  Eye: ['view'], EyeSlash: ['view'], ArrowTopRightOnSquare: ['view'],
  ArrowPath: ['refresh'],
  Phone: ['call'], PhoneArrowUpRight: ['call'],
  Cog6Tooth: ['settings'], Cog8Tooth: ['settings'], Cog: ['settings'],
};
function intentOf(text) {
  const hits = new Set();
  for (const [re, i] of ACTION) if (re.test(text)) hits.add(i);
  return [...hits];
}

// ---------- A + C: scan control elements ----------
const semMismatch = [], noName = [];
const dataSet = new Map(), dataUsed = new Map();

for (const f of files) {
  const src = fs.readFileSync(f, 'utf8');
  const rel = f.replace(/\\/g, '/').replace('C:/Projects/stormleads/', '');
  const lineOf = idx => src.slice(0, idx).split('\n').length;

  // ----- data-* set in JSX -----
  for (const m of src.matchAll(/\bdata-([a-z0-9-]+)\s*=/g)) {
    if (!dataSet.has(m[1])) dataSet.set(m[1], []);
    dataSet.get(m[1]).push(rel + ':' + lineOf(m.index));
  }
  // ----- data-* queried (selectors, dataset.x, getAttribute) -----
  for (const m of src.matchAll(/\[data-([a-z0-9-]+)[\]=]/g)) {
    if (!dataUsed.has(m[1])) dataUsed.set(m[1], []);
    dataUsed.get(m[1]).push(rel + ':' + lineOf(m.index));
  }
  for (const m of src.matchAll(/dataset\.([A-Za-z0-9_]+)/g)) {
    const kebab = m[1].replace(/[A-Z]/g, c => '-' + c.toLowerCase());
    if (!dataUsed.has(kebab)) dataUsed.set(kebab, []);
    dataUsed.get(kebab).push(rel + ':' + lineOf(m.index));
  }
  for (const m of src.matchAll(/getAttribute\(\s*['"]data-([a-z0-9-]+)['"]/g)) {
    if (!dataUsed.has(m[1])) dataUsed.set(m[1], []);
    dataUsed.get(m[1]).push(rel + ':' + lineOf(m.index));
  }

  // ----- buttons -----
  const openRe = /<button\b/g;
  let m;
  while ((m = openRe.exec(src))) {
    const start = m.index;
    const end = src.indexOf('</button>', start);
    if (end === -1 || end - start > 3000) continue;
    const block = src.slice(start, end);
    const line = lineOf(start);

    const title = (block.match(/\btitle=(?:"([^"]*)"|\{`([^`]*)`\})/) || [])[1] || '';
    const aria = (block.match(/\baria-label=(?:"([^"]*)"|\{`([^`]*)`\})/) || [])[1] || '';
    const onClick = (block.match(/onClick=\{[^}]{0,120}/) || [''])[0];
    // inner text = text nodes outside tags
    const inner = block.replace(/<[^>]*>/g, ' ').replace(/\{[^}]*\}/g, ' ').replace(/\s+/g, ' ').trim();
    const icons = [...block.matchAll(/<([A-Z][A-Za-z0-9]*)Icon\b/g)].map(x => x[1]);

    const label = [title, aria, inner].filter(Boolean).join(' | ');
    const nameSrc = [title, aria, inner, onClick].join(' ');

    // C: icon-only, no accessible name
    if (icons.length && !title && !aria && !inner) {
      noName.push({ file: rel, line, icons: icons.join(','), onClick: onClick.slice(0, 70) });
    }
    // A: icon vs action mismatch
    if (icons.length === 1 && label) {
      const ic = icons[0];
      const allowed = ICON[ic];
      if (allowed) {
        const want = intentOf(label) ;
        if (want.length && !want.some(w => allowed.includes(w))) {
          semMismatch.push({ file: rel, line, icon: ic + 'Icon', iconMeans: allowed.join('/'), label: label.slice(0, 70), labelMeans: want.join('/') });
        }
      }
    }
  }
}

// ---------- CSS side of data-* ----------
const css = fs.readFileSync(SRC + '/index.css', 'utf8');
for (const m of css.matchAll(/\[data-([a-z0-9-]+)[\]=]/g)) {
  if (!dataUsed.has(m[1])) dataUsed.set(m[1], []);
  dataUsed.get(m[1]).push('index.css');
}

const dataOrphans = [...dataSet.keys()].filter(k => !dataUsed.has(k)).map(k => ({ attr: 'data-' + k, setAt: dataSet.get(k).slice(0, 4), nSet: dataSet.get(k).length }));
const dataGhosts = [...dataUsed.keys()].filter(k => !dataSet.has(k)).map(k => ({ attr: 'data-' + k, usedAt: dataUsed.get(k).slice(0, 4) }));

console.log(JSON.stringify({
  filesScanned: files.length,
  A_iconActionMismatch: semMismatch,
  B_dataAttrSetNeverQueried: dataOrphans,
  B_dataAttrQueriedNeverSet: dataGhosts,
  C_iconOnlyNoAccessibleName: noName,
}, null, 1));
