import * as svc from './src/services/estimateService.js';
import pool from './src/db/pool.js';
const TENANT='791bb51d-3293-4839-92e9-bd4d4f873af2', USER='45cc729d-cc5b-44b5-93ca-7c01b427fc26';
for (const [label,id] of [['EST-083 [null]','1252940b-b691-4182-8d4f-680ac71a0711'],
                          ['EST-082 [null,"",1]','2dd4659c-ed16-4353-9ee6-5dfdf944f365']]) {
  try { await svc.generateTiers(TENANT, USER, id); console.log(label,'-> OK (no throw)'); }
  catch (e) { console.log(label,'-> THROWS:', e.constructor.name+':', e.message);
    console.log('   at:', (e.stack.split('\n')[1]||'').trim()); }
}
await pool.end();
