import fs from 'fs';
import { req, summarize } from './.qa-r78-lib.mjs';
const ids = JSON.parse(fs.readFileSync('C:/tmp/qa-r78-ids.json', 'utf8'));
const notes = [];

// property_id rides on the lead rows themselves — cheapest source of a real property id
const l = await req('GET', '/api/crm/leads?limit=50');
const leads = Array.isArray(l.body) ? l.body : (l.body?.leads || l.body?.data || []);
notes.push(`leads list: ${leads.length} rows`);
for (const ld of leads) { if (ld.property_id) { ids.property = ld.property_id; notes.push(`property from lead ${ld.id}.property_id`); break; } }

// fallback: in-swath now that a stormEventId exists
if (!ids.property && ids.stormEventId) {
  const r = await req('GET', `/api/properties/in-swath/${ids.stormEventId}`);
  let rows = Array.isArray(r.body) ? r.body : (r.body?.properties || r.body?.features || r.body?.data);
  notes.push(`in-swath -> ${r.status} ${summarize(r.body)} rows=${Array.isArray(rows)?rows.length:'n/a'}`);
  if (Array.isArray(rows) && rows.length) ids.property = rows[0].id ?? rows[0].properties?.id;
}

// full lead detail key dump — is there a contacts array at all?
if (ids.lead) {
  const d = await req('GET', `/api/crm/leads/${ids.lead}`);
  const body = d.body?.lead ?? d.body;
  notes.push(`lead detail keys: ${Object.keys(body || {}).join(',')}`);
  for (const k of ['contacts','lead_contacts','contact_list']) {
    if (Array.isArray(body?.[k]) && body[k].length) { ids.contact = body[k][0].id; ids.leadWithContact = ids.lead; notes.push(`contact from detail.${k}`); }
  }
}
// scan several leads for an embedded contact
if (!ids.contact) {
  for (const ld of leads.slice(0, 10)) {
    const d = await req('GET', `/api/crm/leads/${ld.id}`);
    const body = d.body?.lead ?? d.body;
    const arr = body?.contacts;
    if (Array.isArray(arr) && arr.length) { ids.contact = arr[0].id; ids.leadWithContact = ld.id; notes.push(`contact on lead ${ld.id}`); break; }
  }
}
fs.writeFileSync('C:/tmp/qa-r78-ids.json', JSON.stringify(ids, null, 1));
console.log('property =', ids.property || 'MISS');
console.log('contact  =', ids.contact || 'MISS');
console.log('resolved:', Object.values(ids).filter(Boolean).length, 'of', Object.keys(ids).length);
notes.forEach(n => console.log(' -', n));
