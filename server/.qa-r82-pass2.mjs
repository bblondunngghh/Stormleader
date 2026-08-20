import fs from 'fs';
const TOKEN=fs.readFileSync('C:/tmp/qa-token.txt','utf8').trim();
const I=JSON.parse(fs.readFileSync('C:/tmp/qa-r82-ids.json','utf8'));
const BASE='http://localhost:3001';
const BBOX='-95.8,29.5,-95.0,30.1';           // Harris County TX
const cases=[
 ['/api/crm/calendar?start=2026-01-01&end=2026-12-31'],
 ['/api/data/directions?fromLat=29.76&fromLng=-95.37&toLat=29.80&toLng=-95.40'],
 [`/api/disaster-declarations?state=${I.countyState}&county=${I.countyName}`],
 [`/api/map/affected-properties?bbox=${BBOX}`],
 [`/api/map/swaths?bbox=${BBOX}`],
 [`/api/map/storm-swaths?bbox=${BBOX}`],
 [`/api/map/properties?bbox=${BBOX}`],
 [`/api/properties?bbox=${BBOX}`],
 [`/api/properties/fema-live?bbox=${BBOX}`],
 ['/api/storm-history?lat=29.76&lng=-95.37'],
 [`/api/storm-history/heatmap?bbox=${BBOX}`],
 [`/api/counties/${I.county}/status`],
 ['/api/data/fema-housing?zip=77002'],
 ['/api/data/census-demographics?zip=77002'],
 ['/api/search?q=roof'],
 [`/api/crm/prospect-lists/${I.prospectList}/items`],
 [`/api/crm/financing/plans`],
 [`/api/leads/status/public/${I.statusToken}`],
 [`/api/estimates/public/${I.estimateToken}`],
 // filters / pagination / sorting on the big list routes
 ['/api/crm/leads?page=1&limit=5&sort_by=created_at&sort_order=desc'],
 ['/api/crm/leads?stage=new&priority=hot&search=roof'],
 ['/api/crm/leads?limit=abc&page=-5'],
 ['/api/estimates?status=draft&limit=5'],
 ['/api/crm/invoices?status=paid'],
 ['/api/crm/work-orders?status=scheduled'],
 ['/api/crm/tasks?completed=false'],
 ['/api/crm/expenses?category=materials'],
 ['/api/dashboard/stats'],['/api/dashboard/funnel'],['/api/dashboard/activity'],
];
const out=[];
for (const [p] of cases){
  try{
    const t0=Date.now();
    const r=await fetch(BASE+p,{headers:{Authorization:'Bearer '+TOKEN}});
    const ms=Date.now()-t0;
    const ct=r.headers.get('content-type')||'';
    const b=ct.includes('json')?JSON.stringify(await r.json().catch(()=>null)):(await r.text()).slice(0,200);
    out.push({p,status:r.status,ms,len:b.length,snip:b.slice(0,220)});
  }catch(e){ out.push({p,status:'FETCH_ERR',snip:e.message}); }
}
fs.writeFileSync('C:/tmp/qa-r82-pass2.json',JSON.stringify(out,null,1));
for(const r of out) console.log(`${String(r.status).padEnd(6)} ${String(r.ms||'').padStart(5)}ms len=${String(r.len).padStart(6)} ${r.p}`);
console.log('\n=== NON-2xx DETAIL ===');
for(const r of out.filter(x=>x.status>=300||typeof x.status==='string')) console.log(`${r.status} ${r.p}\n   ${r.snip}`);
