// Do the routes with NO validateId crash (500 / 22P02) when a non-UUID reaches SQL?
// Read-only GETs only. counties POST /:id/import is deliberately EXCLUDED — it starts a
// real bulk property import (standing gotcha).
import fs from 'fs';
const T = fs.readFileSync('C:/tmp/qa-token.txt','utf8').trim();
const BASE='http://localhost:3001';
const targets = [
  ['GET','/api/counties/not-a-uuid/status'],
  ['GET','/api/materials/products/not-a-uuid'],
  ['GET','/api/storms/not-a-uuid'],
  ['GET','/api/counties/99999999/status'],
  ['GET','/api/storms/99999999'],
  ['GET',"/api/storms/' OR 1=1--"],
];
for (const [m,p] of targets) {
  try {
    const r = await fetch(BASE+p,{method:m,headers:{Authorization:`Bearer ${T}`}});
    const t = await r.text();
    const flag = r.status >= 500 ? '  <-- 500 CRASH' : '';
    console.log(`${r.status} ${m} ${p}${flag}`);
    if (r.status >= 500) console.log('     body:', t.slice(0,200));
  } catch(e) { console.log(`ERR ${m} ${p}`, String(e).slice(0,90)); }
}
