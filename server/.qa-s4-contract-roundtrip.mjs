import fs from 'fs';
const TOK = fs.readFileSync('C:/tmp/qa-token.txt','utf8').trim();
const H = {'Content-Type':'application/json','Authorization':`Bearer ${TOK}`};
const api = async (m,p,b) => { const r = await fetch('http://localhost:3001/api'+p,{method:m,headers:H,body:b?JSON.stringify(b):undefined}); let j=null; try{j=await r.json();}catch{} return {s:r.status,j}; };

const leads = await api('GET','/crm/leads?limit=1');
const lead = (leads.j?.leads||leads.j?.data||leads.j)[0];
console.log('lead', lead.id, JSON.stringify(lead.contact_name), JSON.stringify(lead.address));
const tpl = await api('GET','/crm/contracts/templates');
const templates = tpl.j?.templates || tpl.j;
console.log('templates', templates.map(t=>`${t.type}:${t.name}`).join(' | '));
// pick a NON-first, NON-standard template to prove the picker/template_type fix
const pick = templates.find(t=>t.type!=='standard') || templates[0];
console.log('picking', pick.type, pick.id);

// 1. POST with snake_case lead_id — used to 400
const payload = { lead_id: lead.id, template_type: pick.type,
  content: { sections:[{title:'S4 Section', body:'S4 body'}],
    customer_name:'S4 Customer', customer_email:'s4@example.com',
    customer_phone:'555-0104', customer_address:'104 S4 Way' } };
const created = await api('POST','/crm/contracts', payload);
console.log('POST snake_case lead_id ->', created.s, created.s===201||created.s===200 ? 'OK' : JSON.stringify(created.j).slice(0,200));
const cid = (created.j?.contract||created.j)?.id;
if (!cid) process.exit(1);

// 2. GET back: template_type + content.customer_* must survive
const got = await api('GET',`/crm/contracts/${cid}`);
const c = got.j?.contract || got.j;
console.log('template_type stored:', c.template_type, c.template_type===pick.type ? 'OK (not forced to standard)' : 'FAIL');
const ct = c.content || {};
console.log('content.customer_*:', JSON.stringify({n:ct.customer_name,e:ct.customer_email,p:ct.customer_phone,a:ct.customer_address}));
console.log('content.sections kept:', Array.isArray(ct.sections) && ct.sections.length===1 ? 'OK' : 'FAIL '+JSON.stringify(ct.sections));

// 3. PATCH (edit path) — change customer name inside content, must persist
const upd = await api('PATCH',`/crm/contracts/${cid}`, { template_type:'standard', content:{...ct, customer_name:'S4 Edited'} });
const g2 = await api('GET',`/crm/contracts/${cid}`);
const c2 = g2.j?.contract || g2.j;
console.log('PATCH', upd.s, '-> customer_name:', c2.content?.customer_name, 'template_type:', c2.template_type);

// 4. camelCase still accepted (backwards compat claim)
const cc = await api('POST','/crm/contracts', { leadId: lead.id, templateType:'standard', content:{sections:[]} });
console.log('POST camelCase leadId ->', cc.s, cc.s<300?'OK (back-compat)':JSON.stringify(cc.j).slice(0,120));
const cid2 = (cc.j?.contract||cc.j)?.id;

// 5. missing lead_id still rejected
const bad = await api('POST','/crm/contracts', { content:{sections:[]} });
console.log('POST no lead_id ->', bad.s, bad.j?.error);

// cleanup
for (const id of [cid, cid2].filter(Boolean)) console.log('DELETE', id, (await api('DELETE',`/crm/contracts/${id}`)).s);
const fin = await api('GET','/crm/contracts');
console.log('contracts remaining:', (fin.j?.contracts||fin.j?.data||fin.j).length);
