// Run 89 s3-ui-audit — CHECK: duplicate CSS selector blocks that set the SAME property
// to CONFLICTING values. A later block silently wins, so a component styled via the
// earlier rule renders differently from what the source reads like.
//
// Self-test: pass a second argv to inject a known positive.
//   node .qa-r89-cssdupe.mjs <cssFile> [--selftest]
import fs from 'fs';

const file = process.argv[2] || 'C:/Projects/stormleads/client/src/index.css';
let css = fs.readFileSync(file, 'utf8');

if (process.argv.includes('--selftest')) {
  css += '\n.qa-selftest-dupe { height: 36px; }\n.qa-selftest-dupe { height: 48px; }\n';
}

// Strip comments only (never track quotes — Run 86 lesson).
css = css.replace(/\/\*[\s\S]*?\*\//g, '');

// Walk top-level blocks, tracking @-rule context so we do not compare a rule inside
// @media (max-width:768px) against the same selector at top level (that is legitimate).
const blocks = [];
let depth = 0, buf = '', ctxStack = [], selStart = 0;
for (let i = 0; i < css.length; i++) {
  const ch = css[i];
  if (ch === '{') {
    if (depth === 0) selStart = buf.trim();
    depth++;
    if (depth === 1) { buf = ''; continue; }
    if (depth > 1 && /^@/.test(selStart)) { /* nested */ }
    buf += ch; continue;
  }
  if (ch === '}') {
    depth--;
    if (depth === 0) {
      const sel = selStart;
      if (/^@(media|supports|layer|container)/.test(sel)) {
        // Recurse one level into at-rules, tagging context.
        const inner = buf;
        let d2 = 0, b2 = '', s2 = '';
        for (let j = 0; j < inner.length; j++) {
          const c2 = inner[j];
          if (c2 === '{') { if (d2 === 0) s2 = b2.trim(); d2++; if (d2 === 1) { b2 = ''; continue; } }
          if (c2 === '}') { d2--; if (d2 === 0) { blocks.push({ ctx: sel.slice(0, 40), sel: s2, body: b2 }); b2 = ''; continue; } }
          b2 += c2;
        }
      } else {
        blocks.push({ ctx: '', sel, body: buf });
      }
      buf = ''; continue;
    }
    buf += ch; continue;
  }
  buf += ch;
}

// Index: (context + single selector) -> [{prop, value, idx}]
const byKey = new Map();
blocks.forEach((b, idx) => {
  if (/^@/.test(b.sel) || !b.sel) return;
  for (const rawSel of b.sel.split(',')) {
    const sel = rawSel.replace(/\s+/g, ' ').trim();
    if (!sel) continue;
    const key = b.ctx + '||' + sel;
    const decls = [];
    for (const d of b.body.split(';')) {
      const c = d.indexOf(':');
      if (c < 0) continue;
      const prop = d.slice(0, c).trim().toLowerCase();
      const val = d.slice(c + 1).trim().replace(/\s+/g, ' ');
      if (!prop || prop.startsWith('--') || !val) continue;
      decls.push({ prop, val });
    }
    if (!decls.length) continue;
    if (!byKey.has(key)) byKey.set(key, []);
    byKey.get(key).push({ idx, decls });
  }
});

const findings = [];
for (const [key, occurrences] of byKey) {
  if (occurrences.length < 2) continue;
  const [ctx, sel] = key.split('||');
  // Which properties are set more than once with DIFFERENT values?
  const propVals = new Map();
  for (const occ of occurrences) {
    for (const { prop, val } of occ.decls) {
      if (!propVals.has(prop)) propVals.set(prop, new Set());
      propVals.get(prop).add(val);
    }
  }
  const conflicts = [...propVals.entries()].filter(([, v]) => v.size > 1);
  if (conflicts.length) {
    findings.push({
      sel, ctx: ctx || '(top-level)', blocks: occurrences.length,
      conflicts: conflicts.map(([p, v]) => `${p}: ${[...v].join('  VS  ')}`)
    });
  }
}

console.log(JSON.stringify({
  file, totalBlocks: blocks.length, distinctSelectors: byKey.size,
  duplicatedSelectors: [...byKey.values()].filter(v => v.length > 1).length,
  conflictCount: findings.length,
  findings: findings.slice(0, 25)
}, null, 2));
