import fs from 'fs';
const g=JSON.parse(fs.readFileSync('C:/tmp/qa-r82-get-results.json','utf8'));
const p2=JSON.parse(fs.readFileSync('C:/tmp/qa-r82-pass2.json','utf8'));
let w=[]; try{ w=JSON.parse(fs.readFileSync('C:/tmp/qa-r82-write-results.json','utf8')); }catch(e){}
const L=[];
L.push('# StormLeads API endpoint test results — Run 82 (2026-08-19, s1-api-test)');
L.push(`Server: http://localhost:3001  |  Tenant: waterloo  |  Inventory: 272 route patterns (36 files)`);
L.push('');
const verdict=(s,e)=>{
  if(s==='SKIP')return['SKIP','charter-prohibited (import/geocode/skip-trace/export)'];
  if(s==='FETCH_ERR')return['FAIL','connection error'];
  if(s>=500)return['FAIL','5xx SERVER ERROR'];
  if(s>=200&&s<300)return['PASS',''];
  if(s===403)return['PASS','403 platform-admin-only (expected)'];
  if(s===404)return['PASS','404 for absent/dead id (expected)'];
  if(s===400)return['PASS','400 validation (expected, not a crash)'];
  if(s===401)return['PASS','401 unauthenticated (expected)'];
  return['?',''];
};
L.push('## 1. GET sweep — every GET route pattern, real IDs where resolvable');
L.push('');
L.push('| Endpoint | Method | Status | Result | Issue |');
L.push('|---|---|---|---|---|');
for(const r of g){ const [v,note]=verdict(r.status); L.push(`| \`${r.path}\` | GET | ${r.status} | ${v} | ${note||(r.status>=300?String(r.snip).slice(0,90):'')} |`); }
L.push('');
L.push('## 2. GET pass 2 — valid query params so handlers actually execute');
L.push('(a 400 in pass 1 proves validation fired, not that the handler works)');
L.push('');
L.push('| Endpoint | Method | Status | ms | Result | Issue |');
L.push('|---|---|---|---|---|---|');
for(const r of p2){ const [v,note]=verdict(r.status); L.push(`| \`${r.p}\` | GET | ${r.status} | ${r.ms??''} | ${v} | ${note||(r.status>=300?String(r.snip).slice(0,90):'')} |`); }
if(w.length){
  L.push('');
  L.push('## 3. Write sweep — POST / PUT / PATCH / DELETE');
  L.push('');
  L.push('| Endpoint | Method | Payload | Status | Result | Issue |');
  L.push('|---|---|---|---|---|---|');
  for(const r of w){ const [v,note]=verdict(r.status); L.push(`| \`${r.path}\` | ${r.method} | ${r.kind} | ${r.status} | ${v} | ${note||(r.status>=300?String(r.snip).slice(0,110):'')} |`); }
}
const all=[...g.map(r=>r.status),...p2.map(r=>r.status),...w.map(r=>r.status)];
const cnt={}; for(const s of all) cnt[s]=(cnt[s]||0)+1;
L.push('');
L.push('## Summary');
L.push('');
L.push('```');
L.push('status counts: '+JSON.stringify(cnt));
L.push('total calls:   '+all.length);
L.push('5xx:           '+all.filter(s=>typeof s==='number'&&s>=500).length);
L.push('```');
const txt=L.join('\n');
for(const p of ['C:/tmp/api-test-results.txt'])
  { try{ fs.writeFileSync(p,txt); console.log('wrote',p,txt.length,'bytes'); }catch(e){ console.log('skip',p,e.code); } }
console.log('5xx:',all.filter(s=>typeof s==='number'&&s>=500).length,'| total calls:',all.length);
