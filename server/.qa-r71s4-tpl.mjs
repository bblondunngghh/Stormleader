import pool from './src/db/pool.js';
const t = (await pool.query(`select id,name,type,jsonb_typeof(content) ct, content from contract_templates limit 10`)).rows;
console.log('--- contract_templates ---');
for(const r of t) console.log(`  ${r.name} | type=${r.type} | contentType=${r.ct} | sections=${Array.isArray(r.content?.sections)?r.content.sections.length:'none'} | keys=${r.content&&typeof r.content==='object'?Object.keys(r.content).join(','):typeof r.content}`);
console.log('\n--- contracts: does any have sections? ---');
const c = (await pool.query(`select id, template_type, estimate_id, created_at, content from contracts order by created_at`)).rows;
for(const r of c) console.log(`  ${r.id.slice(0,8)} tmpl=${String(r.template_type).padEnd(10)} est=${r.estimate_id?'yes':'no '} sections=${Array.isArray(r.content?.sections)?r.content.sections.length:'NONE'} keys=${r.content&&typeof r.content==='object'?Object.keys(r.content).join(','):JSON.stringify(r.content)}`);
await pool.end();
