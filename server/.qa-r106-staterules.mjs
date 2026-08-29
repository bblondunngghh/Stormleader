/**
 * Run 106 (s3 ui-audit) — parse index.css into a rule table.
 *
 * document.styleSheets returns [] under Vite dev (Runs 80/94 trap), so the rule
 * text has to come from disk and be handed to the page as data.
 *
 * Emits every rule (selector, order, declarations, !important flags) plus the
 * derived STATE-BLOCK table CHECK C needs (base selector = pseudo stripped).
 *
 * --selftest plants known-shaped CSS and asserts the parser recovers it.
 */
import fs from 'fs';

const STATE = /:(hover|active|focus-visible|focus-within|focus|disabled|checked)\b/;

function parse(css) {
  const clean = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const rules = [];
  let order = 0;

  function walk(text, at) {
    let i = 0, sel = '';
    while (i < text.length) {
      const ch = text[i];
      if (ch === '{') {
        // read balanced body
        let d = 1, body = '';
        i++;
        while (i < text.length && d > 0) {
          if (text[i] === '{') d++;
          else if (text[i] === '}') { d--; if (d === 0) { i++; break; } }
          body += text[i];
          i++;
        }
        const s = sel.trim();
        sel = '';
        if (!s) continue;
        if (s.startsWith('@')) {
          // at-rule: recurse only if it contains nested rules
          if (/@(media|supports|layer|container)/.test(s)) walk(body, s);
          continue;
        }
        rules.push({ sel: s, body, order: order++, at: at || null });
        continue;
      }
      sel += ch;
      i++;
    }
  }
  walk(clean, null);
  return rules;
}

function decls(body) {
  const out = {};
  // only top-level declarations (skip anything inside a nested block)
  let depth = 0, cur = '';
  const parts = [];
  for (const ch of body) {
    if (ch === '{') depth++;
    else if (ch === '}') depth--;
    if (ch === ';' && depth === 0) { parts.push(cur); cur = ''; continue; }
    cur += ch;
  }
  if (cur.trim()) parts.push(cur);
  for (const d of parts) {
    if (d.includes('{')) continue;
    const c = d.indexOf(':');
    if (c < 0) continue;
    const p = d.slice(0, c).trim();
    let v = d.slice(c + 1).trim();
    if (!p || p.startsWith('--') || /\s/.test(p)) continue;
    const imp = /!important\s*$/.test(v);
    v = v.replace(/!important\s*$/, '').trim();
    out[p] = { v, imp };
  }
  return out;
}

function stateTable(rules) {
  const st = [];
  for (const r of rules) {
    const d = decls(r.body);
    if (!Object.keys(d).length) continue;
    for (const one of r.sel.split(',')) {
      const s = one.trim();
      if (!STATE.test(s) || s.includes('::')) continue;
      const base = s.replace(/:(hover|active|focus-visible|focus-within|focus|disabled|checked)\b/g, '').trim();
      if (!base) continue;
      st.push({ sel: s, base, order: r.order, at: r.at, decls: d });
    }
  }
  return st;
}

if (process.argv.includes('--selftest')) {
  const fixture = `
    /* comment { with braces } */
    .a { color: red; }
    .a:hover { color: blue; background: none; }
    .b, .c:focus { padding: 4px !important; }
    @media (max-width: 768px) { .d:hover { margin: 0; } }
    @keyframes spin { from { transform: rotate(0) } to { transform: rotate(360deg) } }
    .e:hover .f { border: none; }
  `;
  const rules = parse(fixture);
  const st = stateTable(rules);
  const checks = [
    ['parses plain rule', rules.some(r => r.sel === '.a')],
    ['skips @keyframes inner blocks as rules', !rules.some(r => /^(from|to)$/.test(r.sel))],
    ['recurses @media', st.some(r => r.sel === '.d:hover' && r.at && r.at.includes('media'))],
    ['splits selector list', st.some(r => r.sel === '.c:focus' && r.base === '.c')],
    ['reads !important flag', st.some(r => r.decls.padding && r.decls.padding.imp === true)],
    ['strips pseudo for base', st.some(r => r.sel === '.a:hover' && r.base === '.a')],
    ['descendant base kept', st.some(r => r.sel === '.e:hover .f' && r.base === '.e .f')],
    ['collects all decls', st.find(r => r.sel === '.a:hover') && Object.keys(st.find(r => r.sel === '.a:hover').decls).sort().join(',') === 'background,color'],
  ];
  let pass = 0;
  for (const [n, ok] of checks) { console.log((ok ? 'PASS' : 'FAIL') + '  ' + n); if (ok) pass++; }
  console.log(`selftest ${pass}/${checks.length}`);
  process.exit(pass === checks.length ? 0 : 1);
}

const css = fs.readFileSync('client/src/index.css', 'utf8');
const rules = parse(css);
const st = stateTable(rules);
fs.writeFileSync('C:/tmp/qa-r106-staterules.json', JSON.stringify(st));
fs.writeFileSync('C:/tmp/qa-r106-allrules.json', JSON.stringify(
  rules.map(r => ({ sel: r.sel, order: r.order, at: r.at, decls: decls(r.body) }))
));
console.log('rules parsed          :', rules.length);
console.log('state rules           :', st.length);
console.log('distinct base selectors:', new Set(st.map(r => r.base)).size);
console.log('pseudo breakdown      :', JSON.stringify(
  st.reduce((a, r) => { const m = r.sel.match(STATE)[1]; a[m] = (a[m] || 0) + 1; return a; }, {})));
