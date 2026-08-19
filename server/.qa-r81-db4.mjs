import 'dotenv/config';
import pool from './src/db/pool.js';
const q = async (sql,p=[]) => { try { return (await pool.query(sql,p)).rows; } catch(e){ return [{ERR:e.code+' '+e.message.split('\n')[0]}]; } };
console.log(JSON.stringify({
  automations: await q(`SELECT column_name, data_type, is_nullable, column_default FROM information_schema.columns WHERE table_name='automations' ORDER BY ordinal_position`),
}, null, 1));
process.exit(0);
