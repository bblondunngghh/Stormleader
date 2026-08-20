const B='http://localhost:3001';
const j = await (await fetch(B+'/api/auth/login',{method:'POST',headers:{'content-type':'application/json'},
  body:JSON.stringify({email:'waterlooconstruction1@gmail.com',password:'2Wealth&health',tenantSlug:'waterloo'})})).json();
const H={authorization:'Bearer '+j.accessToken,'content-type':'application/json'};

// 1. the contract the browser just created
const c = await (await fetch(B+'/api/crm/contracts/13b0091c-e646-4997-9289-2a3cb65b1a95',{headers:H})).json();
console.log('created contract template_type =', c.template_type, '| lead_id set =', !!c.lead_id);

// 2. customer round trip through content
const up = await fetch(B+'/api/crm/contracts/'+c.id,{method:'PATCH',headers:H,body:JSON.stringify({
  content:{ sections:[{title:'S',body:'B'}], customer_name:'QA82 Contract Customer', customer_email:'c@q.com', customer_phone:'555-0182', customer_address:'9 QA Ct' }})});
console.log('PATCH ->', up.status);
const c2 = await (await fetch(B+'/api/crm/contracts/'+c.id,{headers:H})).json();
console.log('READ BACK: name=', c2.content.customer_name, '| email=', c2.content.customer_email, '| phone=', c2.content.customer_phone, '| addr=', c2.content.customer_address);

// 3. prefill keys on a lead that HAS a contact_name
const leads = await (await fetch(B+'/api/crm/leads?limit=60',{headers:H})).json();
const withName = (leads.leads||leads.data||leads).find(l=>l.contact_name);
if (withName) {
  const d = await (await fetch(B+'/api/crm/leads/'+withName.id,{headers:H})).json();
  console.log('PREFILL SOURCE lead:', JSON.stringify({contact_name:d.contact_name, contact_email:d.contact_email, contact_phone:d.contact_phone, address:d.address}));
  console.log('  OLD code would read owner_name/first_name/email/phone ->',
    JSON.stringify([d.owner_name, d.first_name, d.email, d.phone]));
}
