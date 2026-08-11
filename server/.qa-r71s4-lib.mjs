export const B = 'http://localhost:3001';
export async function login(){
  const r = await fetch(B+'/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({email:'waterlooconstruction1@gmail.com',password:'2Wealth&health',tenantSlug:'waterloo'})});
  const j = await r.json();
  if(!j.accessToken) throw new Error('login failed '+r.status+' '+JSON.stringify(j).slice(0,200));
  return j.accessToken;
}
export function mk(T){
  const H = { Authorization:`Bearer ${T}`, 'Content-Type':'application/json' };
  return {
    H,
    api: async (u,o={}) => { const r = await fetch(B+u,{headers:H,...o}); const t = await r.text();
      let d=null; try{d=JSON.parse(t)}catch{} return {s:r.status,t,d}; },
    raw: async (u,o={}) => { const r = await fetch(B+u,{headers:H,...o}); return {s:r.status,buf:Buffer.from(await r.arrayBuffer())}; },
  };
}
