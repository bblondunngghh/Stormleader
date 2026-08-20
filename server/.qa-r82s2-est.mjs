const B='http://localhost:3001';
const r = await fetch(B+'/api/auth/login',{method:'POST',headers:{'content-type':'application/json'},
  body:JSON.stringify({email:'waterlooconstruction1@gmail.com',password:'2Wealth&health',tenantSlug:'waterloo'})});
const j = await r.json();
const T = j.accessToken;
if(!T){ console.log('LOGIN FAIL', r.status, JSON.stringify(j).slice(0,200)); process.exit(1); }
const H = {authorization:'Bearer '+T,'content-type':'application/json'};
const list = await (await fetch(B+'/api/estimates?limit=3',{headers:H})).json();
const est = (list.estimates||list.data||list)[0];
console.log('EST', est.id, est.estimate_number);
console.log('KEYS ON GET:', Object.keys(est).join(','));
console.log('has profit_margin?', 'profit_margin' in est, '| discounts?', 'discounts' in est, '| signers?', 'signers' in est, '| deposit?', 'deposit' in est);
const before = JSON.stringify({pm:est.profit_margin, d:est.discounts, s:est.signers, dep:est.deposit});
const p = await fetch(B+'/api/estimates/'+est.id,{method:'PATCH',headers:H,body:JSON.stringify({
  profit_margin: 47, discounts:[{name:'QA probe',type:'flat',value:5}],
  signers:[{first_name:'QA',last_name:'Probe',email:'q@q.com',isPrimary:true}],
  deposit:{amount:'500',description:'QA',type:'flat'}
})});
console.log('PATCH status', p.status);
const after = await (await fetch(B+'/api/estimates/'+est.id,{headers:H})).json();
const a = after.estimate||after.data||after;
console.log('AFTER: profit_margin=',a.profit_margin,' discounts=',JSON.stringify(a.discounts),' signers=',JSON.stringify(a.signers),' deposit=',JSON.stringify(a.deposit));
console.log('BEFORE was', before);
