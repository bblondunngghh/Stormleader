import {login,mk} from './.qa-r71s4-lib.mjs';
const {api} = mk(await login());
const lead = (await api('/api/crm/leads?limit=1')).d;
const leadId = (lead?.leads||lead?.data||lead)[0]?.id;
console.log('using leadId', leadId);

// EXACT payload shape the ContractsView builder sends (ContractsView.jsx:411-419)
const clientPayload = {
  template_id: undefined, lead_id: leadId, estimate_id: undefined,
  customer_name: 'QA R71 Verify', customer_email: 'qa@test.com',
  customer_phone: '555', customer_address: '1 Test St',
  content: { sections: [{ title: 'Scope', body: 'Body text' }] },
};
const a = await api('/api/crm/contracts',{method:'POST',body:JSON.stringify(clientPayload)});
console.log('A client snake_case payload ->', a.s, a.t.slice(0,140));

// what the server actually wants
const b = await api('/api/crm/contracts',{method:'POST',body:JSON.stringify({ leadId, templateType:'standard', content:{sections:[{title:'Scope',body:'Body'}]} })});
console.log('B camelCase payload      ->', b.s, b.t.slice(0,100));
if (b.s===201) { const id=b.d.id; console.log('   created', id, '-> cleaning up'); }
