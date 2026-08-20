const B='http://localhost:3001';
const j = await (await fetch(B+'/api/auth/login',{method:'POST',headers:{'content-type':'application/json'},
  body:JSON.stringify({email:'waterlooconstruction1@gmail.com',password:'2Wealth&health',tenantSlug:'waterloo'})})).json();
const H = {authorization:'Bearer '+j.accessToken,'content-type':'application/json'};
const leads = await (await fetch(B+'/api/crm/leads?limit=1',{headers:H})).json();
const leadId = (leads.leads||leads.data||leads)[0].id;
console.log('lead', leadId);

// EXACTLY what ContractsView.jsx:411-419 sends
const clientPayload = { lead_id: leadId, customer_name:'QA82 Cust', customer_email:'q@q.com',
  customer_phone:'555', customer_address:'1 QA Way', content:{ sections:[{title:'S',body:'B'}] } };
const r1 = await fetch(B+'/api/crm/contracts',{method:'POST',headers:H,body:JSON.stringify(clientPayload)});
console.log('CLIENT-SHAPED POST ->', r1.status, (await r1.text()).slice(0,160));

// what the route actually reads
const r2 = await fetch(B+'/api/crm/contracts',{method:'POST',headers:H,body:JSON.stringify({ leadId, content:{sections:[]} })});
console.log('camelCase POST     ->', r2.status);
if (r2.status===201){ const c = await r2.json(); console.log('  created', c.id, '-> deleting');
  const d = await fetch(B+'/api/crm/contracts/'+c.id,{method:'DELETE',headers:H}); console.log('  DELETE ->', d.status); }
