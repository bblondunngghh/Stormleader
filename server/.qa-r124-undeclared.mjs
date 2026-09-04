// Run 124-s3 (read-only). Finds setters that are CALLED but never DECLARED.
// Catches the half-applied-edit shape that left `setLoadError is not defined`
// in AutomationSettings.jsx (introduced by checkpoint a996c76): the catch block
// was updated, the useState declaration and the JSX branch never were.
// A vite build does NOT catch this — it is a runtime ReferenceError only.
import fs from 'fs';
import path from 'path';

const ROOT = 'C:/Projects/stormleads/client/src';
const files = [];
(function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p);
    else if (/\.(jsx|js)$/.test(e.name)) files.push(p);
  }
})(ROOT);

// setters provided by the platform / libraries, not by component state
const BUILTIN = new Set(['setItem', 'setTimeout', 'setInterval', 'setAttribute',
  'setCustomValidity', 'setData', 'setDate', 'setHours', 'setMinutes', 'setSeconds',
  'setMonth', 'setFullYear', 'setRequestHeader', 'setProperty', 'setSelectionRange',
  'setState', 'setMap', 'setCenter', 'setZoom', 'setPosition', 'setContent',
  'setOptions', 'setVisible', 'setIcon', 'setPaintProperty', 'setLayoutProperty',
  'setStyle', 'setLngLat', 'setHTML', 'setFilter', 'setPath', 'setDraggable',
  'setTransform', 'setLineDash', 'setValues', 'setTime', 'setMilliseconds', 'setUTCHours']);

let bad = 0;
for (const f of files) {
  const src = fs.readFileSync(f, 'utf8');
  const called = new Set();
  for (const m of src.matchAll(/\b(set[A-Z][A-Za-z0-9_]*)\s*\(/g)) called.add(m[1]);
  for (const name of called) {
    if (BUILTIN.has(name)) continue;
    // declared as: useState destructure, a function/const/let, a destructured prop,
    // a named import, or an object-literal/JSX prop the component receives
    const patterns = [
      new RegExp('\\[\\s*[A-Za-z0-9_$]+\\s*,\\s*' + name + '\\s*\\]'), // useState / useReducer
      new RegExp('(function|const|let|var)\\s+' + name + '\\b'),
      new RegExp('\\b' + name + '\\s*[,}]'),   // destructured prop / param
      new RegExp('\\b' + name + '\\s*:'),      // object key or renamed destructure
      new RegExp('\\b' + name + '\\s*=[^=]'),  // assignment / default param
    ];
    if (!patterns.some(p => p.test(src))) {
      console.log('UNDECLARED  ' + path.relative(ROOT, f).replace(/\\/g, '/') + '  ->  ' + name + '()');
      bad++;
    }
  }
}
console.log('---');
console.log('files scanned: ' + files.length + '   undeclared setters: ' + bad);
