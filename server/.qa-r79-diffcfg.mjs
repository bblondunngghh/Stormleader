import fs from 'node:fs';
const API='http://localhost:3001';
const T=fs.readFileSync('C:/tmp/qa-token.txt','utf8').trim();
const H={Authorization:`Bearer ${T}`};
const snap=JSON.parse(fs.readFileSync('C:/tmp/qa-r79-snapshot.json','utf8'));
for(const [p,s] of Object.entries(snap)){
  const r=await fetch(API+p,{headers:H});const now=await r.text();
  const strip=x=>x.replace(/"updated_at":"[^"]*"/g,'').replace(/"last_[a-z_]*":"[^"]*"/g,'');
  console.log((strip(now)===strip(s.body)?'SAME  ':'DIFF  ')+p);
  if(strip(now)!==strip(s.body)){console.log('  before:',s.body.slice(0,300));console.log('  after :',now.slice(0,300));}
}
