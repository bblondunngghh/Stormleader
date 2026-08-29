/**
 * Run 106 (s3 ui-audit) — THE CROSS-SELECTOR !important KILL.
 *
 * Run 102 closed the case where a rule's OWN state variant is killed by its own
 * base (exact selector-prefix match). It explicitly named the general case as
 * still open: an `!important` declaration in one rule killing a declaration in a
 * DIFFERENT rule that matches the same element and *should* win on specificity or
 * source order.
 *
 * This is the static half: enumerate every !important declaration and every rule
 * that could lose to it. The browser half confirms real element overlap.
 */
import fs from 'fs';

const SPEC = (sel) => {
  let s = sel.replace(/\[.#:\[\]]/g, '');
  // strip :not(...) but keep its contents for counting
  const notInner = [...s.matchAll(/:not\(([^)]*)\)/g)].map(m => m[1]).join(' ');
  s = s.replace(/:not\([^)]*\)/g, ' ') + ' ' + notInner;
  const ids = (s.match(/#[\w-]+/g) || []).length;
  const cls = (s.match(/\.[\w-]+/g) || []).length
            + (s.match(/\[[^\]]+\]/g) || []).length
            + (s.match(/:(?!:)[a-z-]+/g) || []).length;
  const els = (s.match(/(^|[\s>+~])([a-z][\w-]*)/gi) || []).length;
  return ids * 10000 + cls * 100 + els;
};

const css = fs.readFileSync('client/src/index.css', 'utf8');
const clean = css.replace(/\/\*[\s\S]*?\*\//g, '');
const rules = [];
let order = 0;
(function walk(text, at) {
  let i = 0, sel = '';
  while (i < text.length) {
    if (text[i] === '{') {
      let d = 1, body = ''; i++;
      while (i < text.length && d > 0) {
        if (text[i] === '{') d++;
        else if (text[i] === '}') { d--; if (d === 0) { i++; break; } }
        body += text[i]; i++;
      }
      const s = sel.trim(); sel = '';
      if (!s) continue;
      if (s.startsWith('@')) { if (/@(media|supports|layer|container)/.test(s)) walk(body, /@media/.test(s) ? s : at); continue; }
      rules.push({ sel: s, body, order: order++, at });
      continue;
    }
    sel += text[i]; i++;
  }
})(clean, null);

const declsOf = (body) => {
  const out = {}; let depth = 0, cur = ''; const parts = [];
  for (const ch of body) {
    if (ch === '{') depth++; else if (ch === '}') depth--;
    if (ch === ';' && depth === 0) { parts.push(cur); cur = ''; continue; }
    cur += ch;
  }
  if (cur.trim()) parts.push(cur);
  for (const d of parts) {
    if (d.includes('{')) continue;
    const c = d.indexOf(':'); if (c < 0) continue;
    const p = d.slice(0, c).trim(); let v = d.slice(c + 1).trim();
    if (!p || p.startsWith('--') || /\s/.test(p)) continue;
    const imp = /!important\s*$/.test(v);
    out[p] = { v: v.replace(/!important\s*$/, '').trim(), imp };
  }
  return out;
};

// flatten to (selector, prop, value, important, order, specificity)
const flat = [];
for (const r of rules) {
  const d = declsOf(r.body);
  for (const one of r.sel.split(',')) {
    const s = one.trim(); if (!s) continue;
    for (const [p, x] of Object.entries(d)) {
      flat.push({ sel: s, prop: p, v: x.v, imp: x.imp, order: r.order, spec: SPEC(s), at: r.at });
    }
  }
}

const imps = flat.filter(f => f.imp);
console.log('total declarations        :', flat.length);
console.log('!important declarations   :', imps.length);
console.log('distinct !important props :', [...new Set(imps.map(i => i.prop))].sort().join(', '));
console.log('');

// candidate kills: a NON-important decl of the same prop that would otherwise win
const cands = [];
for (const imp of imps) {
  for (const f of flat) {
    if (f.imp || f.prop !== imp.prop || f.sel === imp.sel) continue;
    if (f.at !== imp.at) continue;                       // different @media context
    const wouldWin = f.spec > imp.spec || (f.spec === imp.spec && f.order > imp.order);
    if (!wouldWin) continue;
    if (f.v.replace(/\s+/g, '') === imp.v.replace(/\s+/g, '')) continue;  // same value = no-op
    cands.push({ prop: imp.prop, killer: imp.sel, killerVal: imp.v, killerSpec: imp.spec,
                 victim: f.sel, victimVal: f.v, victimSpec: f.spec, at: imp.at });
  }
}
console.log('STATIC CANDIDATE KILLS    :', cands.length);
for (const c of cands) {
  console.log(`  [${c.prop}] ${c.killer} {${c.killerVal}} !imp (spec ${c.killerSpec})`);
  console.log(`      kills -> ${c.victim} {${c.victimVal}} (spec ${c.victimSpec})${c.at ? '  @' + c.at : ''}`);
}
fs.writeFileSync('C:/tmp/qa-r106-impkill.json', JSON.stringify(cands));
