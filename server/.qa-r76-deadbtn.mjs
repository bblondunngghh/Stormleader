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

const out = [];
for (const f of walk(CLIENT)) {
  const src = fs.readFileSync(f, 'utf8');
  // find each <button ...> opening tag, handling nested braces/quotes crudely
  let i = 0;
  while ((i = src.indexOf('<button', i)) !== -1) {
    // walk to the matching '>' that closes the opening tag, tracking braces and quotes
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
    const tag = src.slice(i, end + 1);
    const line = src.slice(0, i).split('\n').length;
    const hasHandler = /\bon[A-Z]\w*\s*=/.test(tag);
    const isSubmit = /type\s*=\s*["']submit["']/.test(tag);
    const spread = /\{\.\.\./.test(tag);
    if (!hasHandler && !isSubmit && !spread) {
      out.push({ file: path.relative(CLIENT, f).split(path.sep).join('/'), line, tag: tag.replace(/\s+/g, ' ').slice(0, 190) });
    }
    i = end + 1;
  }
}
console.log('buttons with NO on* handler, not type=submit, no spread props:', out.length);
console.log(JSON.stringify(out, null, 1));
