import fs from 'node:fs';
const API='http://localhost:3001';
const T=fs.readFileSync('C:/tmp/qa-token.txt','utf8').trim();
const H={Authorization:`Bearer ${T}`};
const paths=['/api/alerts/config','/api/crm/tenant-settings','/api/notifications/preferences','/api/materials/credentials','/api/skip-trace/config','/api/roof-measurement/config','/api/auth/me'];
const snap={};
for(const p of paths){const r=await fetch(API+p,{headers:H});snap[p]={status:r.status,body:await r.text()};}
fs.writeFileSync('C:/tmp/qa-r79-snapshot.json',JSON.stringify(snap,null,1));
for(const p of paths) console.log(p, snap[p].status, snap[p].body.slice(0,220));
