const API = 'http://localhost:3001';
async function login() {
  const r = await fetch(`${API}/api/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({email:'waterlooconstruction1@gmail.com',password:'2Wealth&health',tenantSlug:'waterloo'}),
  });
  return (await r.json()).accessToken;
}
const t = await login();
const cases = [
  ['PATCH /api/auth/me  email=null', 'PATCH', '/api/auth/me', {email:null}],
  ['PATCH /api/auth/me  firstName=null', 'PATCH', '/api/auth/me', {firstName:null}],
  ['PATCH /api/auth/me  email=12345', 'PATCH', '/api/auth/me', {email:12345}],
  ['POST milestones  name=12345', 'POST', '/api/crm/work-orders/00000000-0000-0000-0000-000000000000/milestones', {name:12345}],
  ['POST milestones  name=true', 'POST', '/api/crm/work-orders/00000000-0000-0000-0000-000000000000/milestones', {name:true}],
  ['POST milestones  name=[]', 'POST', '/api/crm/work-orders/00000000-0000-0000-0000-000000000000/milestones', {name:[1,2]}],
  ['POST milestones  name={}', 'POST', '/api/crm/work-orders/00000000-0000-0000-0000-000000000000/milestones', {name:{a:1}}],
  ['POST milestones  name=null', 'POST', '/api/crm/work-orders/00000000-0000-0000-0000-000000000000/milestones', {name:null}],
  ['POST milestones  name=undefined (no field)', 'POST', '/api/crm/work-orders/00000000-0000-0000-0000-000000000000/milestones', {}],
];
for (const [label, m, p, b] of cases) {
  const r = await fetch(API + p, {method:m, headers:{Authorization:`Bearer ${t}`,'Content-Type':'application/json'}, body: JSON.stringify(b)});
  console.log(`${r.status}  ${label}`);
  console.log(`       ${(await r.text()).slice(0,200)}`);
}
