// Run 124-s4 — READ-ONLY. Is the {{merge field}} vocabulary the contract UI advertises
// actually substituted anywhere before a CUSTOMER sees the public contract page?
import pool from './src/db/pool.js';
const q = async (sql) => { try { return (await pool.query(sql)).rows; } catch (e) { return [{ ERR: e.code + ' ' + e.message.slice(0,90) }]; } };
console.log('contracts with {{ in content, by status:',
  JSON.stringify(await q(`SELECT status, count(*) FROM contracts WHERE content::text LIKE '%{{%' GROUP BY status`)));
console.log('ALL contracts by status:',
  JSON.stringify(await q(`SELECT status, count(*) FROM contracts GROUP BY status`)));
console.log('contract_templates with {{:',
  JSON.stringify(await q(`SELECT id, name, (content::text LIKE '%{{%') AS has_tokens FROM contract_templates LIMIT 10`)));
console.log('distinct tokens present in contracts:',
  JSON.stringify(await q(`SELECT DISTINCT unnest(regexp_matches(content::text, '\{\{[a-z_]+\}\}', 'g')) tok FROM contracts`)));
console.log('distinct tokens present in contract_templates:',
  JSON.stringify(await q(`SELECT DISTINCT unnest(regexp_matches(content::text, '\{\{[a-z_]+\}\}', 'g')) tok FROM contract_templates`)));
console.log('estimates with {{ in scope/terms/warranty:',
  JSON.stringify(await q(`SELECT count(*) FROM estimates WHERE coalesce(scope_of_work,'')||coalesce(terms,'')||coalesce(warranty_info,'') LIKE '%{{%'`)));
await pool.end();
