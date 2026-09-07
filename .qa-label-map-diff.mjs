// Read-only static sweep. Rationale (memory, Runs 125/126): the two UI defects fixed last
// run were both "a value rendered in the WRONG vocabulary" - task priority printed in the
// LEAD vocabulary (c7257b7), and an activity type printed raw (39dee53). The existing
// .qa-raw-enum-render.mjs catches the *raw* case. This catches the *divergent-label* case:
// two files that each define a value->label map for the same enum field but disagree on
// what a given value is CALLED. That is the charter's "every visual element follows the
// same standards everywhere" failing on TEXT rather than on CSS.
//
// Colour maps (statusColors) are excluded - only human-readable text labels are compared.
// Output is grouped per field and per defining site so each map can be judged against the
// ENTITY it belongs to (memory: same value name, different entity => different vocabulary
// is legitimate).
import fs from 'fs';
import path from 'path';

const files = [];
(function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p);
    else if (/[.]jsx?$/.test(e.name)) files.push(p);
  }
})('client/src');

const FIELDS = ['priority', 'status', 'stage', 'source', 'category', 'method', 'role', 'type'];
const DECL = /(?:const|let|var)\s+([A-Za-z0-9_]+)\s*=\s*\{/;
const COLOURISH = /^(var\(|oklch|rgb|hsl|#[0-9a-fA-F]{3})/;

// field -> [{ site, name, pairs: {val: label} }]
const maps = new Map();

for (const f of files) {
  const src = fs.readFileSync(f, 'utf8');
  const lines = src.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const m = DECL.exec(lines[i]);
    if (!m) continue;
    const name = m[1];
    const fld = FIELDS.find((x) => new RegExp(x, 'i').test(name));
    if (!fld) continue;
    if (/colou?r/i.test(name)) continue;

    let depth = 0, body = '', started = false;
    for (let j = i; j < Math.min(i + 40, lines.length); j++) {
      for (const c of lines[j]) {
        if (c === '{') { depth++; started = true; }
        else if (c === '}') depth--;
        if (started) body += c;
      }
      body += '\n';
      if (started && depth === 0) break;
    }

    const pairs = {};
    for (const p of body.matchAll(/(?:^|[\s{,])['"]?([a-z][a-z0-9_]*)['"]?\s*:\s*['"]([^'"]{1,40})['"]/gm)) {
      const val = p[1], label = p[2];
      if (COLOURISH.test(label)) continue;
      if (/^(color|bg|background|border|icon|text|label|value|key|id|name)$/.test(val)) continue;
      pairs[val] = label;
    }
    if (Object.keys(pairs).length < 2) continue;
    if (!maps.has(fld)) maps.set(fld, []);
    maps.get(fld).push({ site: `${f.split(String.fromCharCode(92)).join('/')}:${i + 1}`, name, pairs });
  }
}

// Report: for each field, every value that two DIFFERENT maps label differently.
const report = {};
for (const [fld, defs] of maps) {
  const byVal = new Map();
  for (const d of defs) {
    for (const [v, l] of Object.entries(d.pairs)) {
      if (!byVal.has(v)) byVal.set(v, []);
      byVal.get(v).push({ label: l, site: d.site, name: d.name });
    }
  }
  const diverge = [];
  for (const [v, hits] of byVal) {
    const labels = new Set(hits.map((h) => h.label));
    if (labels.size > 1) diverge.push({ value: v, hits });
  }
  report[fld] = { definingSites: defs.map((d) => `${d.site} (${d.name})`), divergent: diverge };
}
console.log(JSON.stringify(report, null, 1));
