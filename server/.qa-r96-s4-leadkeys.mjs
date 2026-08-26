// Run 96 / s4 — what does /api/crm/leads (the endpoint ContractsView's lead search
// actually calls, via getLeads) really carry, and which keys hold a person's name,
// email and phone? READ ONLY.
import fs from 'node:fs';
const TOKEN = fs.readFileSync('C:/tmp/qa-token.txt', 'utf8').trim();

const r = await fetch('http://localhost:3001/api/crm/leads?limit=20', {
  headers: { authorization: 'Bearer ' + TOKEN },
});
const b = await r.json();
const rows = b.leads || b.data || [];
console.log('status', r.status, 'rows', rows.length);

// Union of keys across ALL rows (row[0] alone under-reports if the API omits nulls).
const union = new Set();
for (const row of rows) for (const k of Object.keys(row)) union.add(k);
console.log('\nUNION of keys across all rows:', [...union].sort().join(', '));

// For every key, how many rows have a non-empty value?
console.log('\nKEY  ->  non-empty rows / total   (sample value)');
for (const k of [...union].sort()) {
  const vals = rows.map(x => x[k]).filter(v => v !== null && v !== undefined && v !== '');
  if (!vals.length) continue;
  console.log(`  ${k.padEnd(26)} ${String(vals.length).padStart(2)}/${rows.length}   ${JSON.stringify(vals[0]).slice(0, 60)}`);
}

// The three fields ContractsView.selectLead sets, evaluated per row exactly as the
// FIXED code evaluates them.
console.log('\nPER-ROW: what selectLead() now populates');
console.log('  #  NAME                          EMAIL                     PHONE');
rows.forEach((l, i) => {
  const name = l.contact_name || [l.owner_first_name, l.owner_last_name].filter(Boolean).join(' ');
  const email = l.contact_email || l.owner_email || '';
  const phone = l.contact_phone || l.owner_phone || '';
  console.log(`  ${String(i).padStart(2)} ${String(name || '(blank)').padEnd(29)} ${String(email || '(blank)').padEnd(25)} ${phone || '(blank)'}`);
});

const withEmail = rows.filter(l => l.contact_email || l.owner_email).length;
console.log(`\nSend Contract (gated on customerEmail) would be ENABLED for ${withEmail}/${rows.length} leads after picking one.`);

await 0;
