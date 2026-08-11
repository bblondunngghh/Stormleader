// Run 73 s1 — does contracts.content (JSONB, stored verbatim) crash the contract PDF?
// Creates ONE draft contract, probes shapes via PATCH, then DELETEs the row (net DB writes 0).
import { req, mint } from './.qa-r73-lib.mjs';
import pool from './src/db/pool.js';

await mint();

const LEAD = 'a49da0d8-2ab1-4003-b740-83a31a2e90cf';

// The shapes a malformed/hand-edited content blob can take.
const SHAPES = [
  ['sections = truthy non-array (string)', { sections: 'Agreement text' }],
  ['sections = truthy non-array (number)', { sections: 42 }],
  ['sections = truthy non-array (object)', { sections: { title: 'x', body: 'y' } }],
  ['sections = [null]', { sections: [null] }],
  ['sections = [null, valid]', { sections: [null, { title: 'O', body: 'ok' }] }],
  ['section.body = number', { sections: [{ title: 'T', body: 12345 }] }],
  ['section.body = object', { sections: [{ title: 'T', body: { html: '<p>x</p>' } }] }],
  ['section.body = array', { sections: [{ title: 'T', body: ['a', 'b'] }] }],
  ['section.title = number', { sections: [{ title: 999, body: 'ok' }] }],
  ['content = top-level array', [{ title: 'T', body: 'b' }]],
  ['content = string', 'just a string contract'],
  ['content = number', 12345],
  ['VALID control', { sections: [{ title: 'Agreement', body: '<p>Hello</p>' }] }],
];

const created = await req('POST', '/api/crm/contracts', { leadId: LEAD, content: {} });
if (created.status !== 201) {
  console.log('CREATE FAILED', created.status, JSON.stringify(created.body).slice(0, 300));
  process.exit(1);
}
const id = created.body.id || created.body.contract?.id;
console.log('created draft contract', id, 'status:', created.body.status);

const findings = [];
for (const [label, content] of SHAPES) {
  const patch = await req('PATCH', `/api/crm/contracts/${id}`, { content });
  const pdf = await req('GET', `/api/crm/contracts/${id}/pdf`);
  const crashed = pdf.status >= 500;
  if (crashed) findings.push({ label, patchStatus: patch.status, pdfStatus: pdf.status, err: String(JSON.stringify(pdf.body)).slice(0, 160) });
  console.log(
    `${crashed ? 'CRASH ' : '      '}patch=${String(patch.status).padEnd(4)} pdf=${String(pdf.status).padEnd(4)} ${label}` +
    (crashed ? `\n         -> ${String(JSON.stringify(pdf.body)).slice(0, 200)}` : '')
  );
}

// cleanup — remove the probe row entirely (no DELETE route exists for contracts)
await pool.query('DELETE FROM contracts WHERE id = $1', [id]);
const { rows } = await pool.query('SELECT COUNT(*)::int AS n FROM contracts WHERE id = $1', [id]);
console.log(`\ncleanup: probe contract rows remaining = ${rows[0].n} (net DB writes 0)`);

console.log(`\n=== RESULT: ${findings.length} of ${SHAPES.length} shapes 500 the contract PDF ===`);
findings.forEach(f => console.log('  !!', f.label, '-> pdf', f.pdfStatus, f.err));
await pool.end();
