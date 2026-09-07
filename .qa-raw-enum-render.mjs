// Read-only static sweep for the defect family fixed in CalendarView this run:
// a JSX expression rendering an ENUM COLUMN's raw value straight to the user in a file
// that (or whose siblings) has a label map for that same field.
//
// `tasks.priority` -> `{priority}` printed "hot" where every other task surface printed
// "High". Generalize: find `{x.status}` / `{x.type}` / `{x.priority}` / `{x.stage}` /
// `{x.source}` etc. rendered bare, then report whether a *Labels map for that field
// exists anywhere in client/src.
import fs from 'fs';
import path from 'path';

const ENUM_FIELDS = ['priority', 'status', 'stage', 'source', 'type', 'role', 'category', 'method'];

const files = [];
(function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p);
    else if (/[.]jsx$/.test(e.name)) files.push(p);
  }
})('client/src');

// Which files define a label map for which field?
const labelMaps = new Map(); // field -> [file]
for (const f of files) {
  const s = fs.readFileSync(f, 'utf8');
  for (const fld of ENUM_FIELDS) {
    const re = new RegExp('const\\s+' + fld + '(Labels|Options|Map)\\b', 'i');
    if (re.test(s)) {
      if (!labelMaps.has(fld)) labelMaps.set(fld, []);
      labelMaps.get(fld).push(f.replace(/[\\]/g, '/').replace('client/src/', ''));
    }
  }
}

const hits = [];
for (const f of files) {
  const rel = f.replace(/[\\]/g, '/').replace('client/src/', '');
  const s = fs.readFileSync(f, 'utf8');
  const lines = s.split('\n');
  for (const fld of ENUM_FIELDS) {
    // A bare render: >{expr.field}<  or  {expr.field}  as the sole child of a JSX element.
    // Require the char before `{` to be `>` or whitespace-after-`>` so we skip prop values.
    const re = new RegExp('>\\s*\\{\\s*([A-Za-z_$][\\w$.]*\\.)?' + fld + '\\s*\\}\\s*<', 'g');
    let m;
    while ((m = re.exec(s))) {
      const line = s.slice(0, m.index).split('\n').length;
      const ctx = lines.slice(Math.max(0, line - 2), line + 1).join(' ').replace(/\s+/g, ' ').trim();
      // Skip when the same expression is clearly already a label lookup on that line.
      if (/Labels\[|Options\.find|LABELS\[/.test(ctx)) continue;
      hits.push({
        file: rel, line, field: fld,
        expr: m[0].replace(/\s+/g, ''),
        ownFileHasMap: (labelMaps.get(fld) || []).includes(rel),
        mapDefinedIn: (labelMaps.get(fld) || []).slice(0, 5),
        ctx: ctx.slice(0, 130),
      });
    }
  }
}

hits.sort((a, b) => (a.mapDefinedIn.length ? 0 : 1) - (b.mapDefinedIn.length ? 0 : 1));
console.log(JSON.stringify({
  filesScanned: files.length,
  labelMaps: Object.fromEntries([...labelMaps].map(([k, v]) => [k, v.length])),
  hitCount: hits.length,
  hits,
}, null, 1));
