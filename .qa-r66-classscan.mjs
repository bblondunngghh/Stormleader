// READ-ONLY QA scan: find JSX elements that mix app CSS classes with Tailwind
// utilities. Tailwind's `utilities` layer sits ABOVE `base` (index.css:1), so a
// utility silently beats an app class regardless of specificity.
import fs from 'fs';
import path from 'path';

const files = [];
(function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p);
    else if (p.endsWith('.jsx')) files.push(p);
  }
})('client/src');

const css = fs.readFileSync('client/src/index.css', 'utf8');
const appClasses = new Set([...css.matchAll(/\.([a-zA-Z_][\w-]*)/g)].map(m => m[1]));

const twLike = /^(text-|font-|uppercase$|lowercase$|capitalize$|px-|py-|pt-|pb-|pl-|pr-|p-|m[trblxy]?-|w-|h-|min-|max-|rounded|border$|border-|bg-|flex$|flex-|grid$|grid-|gap-|items-|justify-|shrink|grow|absolute$|relative$|fixed$|inline|block$|hidden$|opacity-|z-|overflow-|space-[xy]-|leading-|tracking-|truncate$|shadow|ring|cursor-|select-|transition|duration-|top-|left-|right-|bottom-|whitespace-|col-|row-|self-|order-|divide-|sr-only$)/;

const hits = [];
for (const f of files) {
  const src = fs.readFileSync(f, 'utf8');
  for (const m of src.matchAll(/className="([^"{}]+)"/g)) {
    const cls = m[1].trim().split(/\s+/).filter(Boolean);
    const app = cls.filter(c => appClasses.has(c));
    const tw = cls.filter(c => !appClasses.has(c) && twLike.test(c));
    const unknown = cls.filter(c => !appClasses.has(c) && !twLike.test(c));
    if (tw.length || unknown.length) {
      const line = src.slice(0, m.index).split('\n').length;
      hits.push({ f: f.split(path.sep).join('/'), line, app, tw, unknown });
    }
  }
}

console.log('--- JSX elements using Tailwind-style utilities or unknown classes ---');
for (const h of hits) {
  console.log(
    `${h.f}:${h.line}  app=[${h.app.join(' ')}]  tw=[${h.tw.join(' ')}]` +
    (h.unknown.length ? `  UNKNOWN=[${h.unknown.join(' ')}]` : '')
  );
}
console.log('total elements:', hits.length);
console.log('MIXED (app class + tailwind utility on the SAME element):',
  hits.filter(h => h.app.length && h.tw.length).length);
console.log('UNKNOWN-class elements (no app class, no tailwind match):',
  hits.filter(h => h.unknown.length).length);
