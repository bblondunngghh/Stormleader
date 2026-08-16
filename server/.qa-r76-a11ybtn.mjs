import fs from 'fs';
import path from 'path';

const CLIENT = 'C:/Projects/stormleads/client/src';
function walk(d, acc = []) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p, acc);
    else if (/\.jsx$/.test(e.name)) acc.push(p);
  }
  return acc;
}

// find <button ...> ... </button> and inspect opening tag + inner content
function findButtons(src) {
  const res = [];
  let i = 0;
  while ((i = src.indexOf('<button', i)) !== -1) {
    let j = i + 7, depth = 0, q = null, end = -1;
    while (j < src.length) {
      const ch = src[j];
      if (q) { if (ch === q && src[j - 1] !== '\\') q = null; }
      else if (ch === '"' || ch === "'" || ch === '`') q = ch;
      else if (ch === '{') depth++;
      else if (ch === '}') depth--;
      else if (ch === '>' && depth === 0) { end = j; break; }
      j++;
    }
    if (end === -1) break;
    const openTag = src.slice(i, end + 1);
    // find matching </button> accounting for nesting
    let k = end + 1, nest = 1, close = -1;
    while (k < src.length) {
      const nextOpen = src.indexOf('<button', k);
      const nextClose = src.indexOf('</button>', k);
      if (nextClose === -1) break;
      if (nextOpen !== -1 && nextOpen < nextClose) { nest++; k = nextOpen + 7; }
      else { nest--; if (nest === 0) { close = nextClose; break; } k = nextClose + 9; }
    }
    const inner = close === -1 ? '' : src.slice(end + 1, close);
    res.push({ start: i, openTag, inner });
    i = end + 1;
  }
  return res;
}

const out = [];
for (const f of walk(CLIENT)) {
  const src = fs.readFileSync(f, 'utf8');
  const rel = path.relative(CLIENT, f).split(path.sep).join('/');
  for (const b of findButtons(src)) {
    const line = src.slice(0, b.start).split('\n').length;
    const hasTitle = /\btitle\s*=/.test(b.openTag);
    const hasAria = /\baria-label\s*=/.test(b.openTag);
    const hasLabelledBy = /\baria-labelledby\s*=/.test(b.openTag);
    if (hasTitle || hasAria || hasLabelledBy) continue;
    // does the inner content have bare text (outside of JSX tags/expressions)?
    let stripped = b.inner
      .replace(/\{[^{}]*(\{[^{}]*\}[^{}]*)*\}/g, '')  // {expressions}
      .replace(/<[^>]*>/g, '')                          // tags
      .replace(/\s+/g, ' ')
      .trim();
    const iconOnly = /<\w*Icon\b|<svg/i.test(b.inner);
    if (!stripped) {
      out.push({ file: rel, line, iconOnly, inner: b.inner.replace(/\s+/g, ' ').trim().slice(0, 80), tag: b.openTag.replace(/\s+/g, ' ').slice(0, 110) });
    }
  }
}
console.log('icon-only / empty <button> with NO title, aria-label or aria-labelledby:', out.length);
const byFile = {};
for (const o of out) (byFile[o.file] ||= []).push(o.line);
console.log(JSON.stringify(byFile, null, 1));
console.log('---DETAIL---');
console.log(JSON.stringify(out, null, 1));
