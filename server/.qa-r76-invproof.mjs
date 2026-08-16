// Proof for the client/server path mismatch on invoice "Send Email".
// SAFE: the correct route validates `to` FIRST (invoices.js:132-133) and returns 400
// before touching the mailer, so probing it with an empty body sends NO email.
import fs from 'fs';
import { req } from './.qa-r76-lib.mjs';
const ids = JSON.parse(fs.readFileSync('C:/tmp/qa-r76-ids.json', 'utf8'));
const id = ids.invoice;

const wrong = await req('POST', `/api/invoices/${id}/send-email`, { to: 'qa@example.com' });
console.log('CLIENT PATH   POST /api/invoices/:id/send-email      ->', wrong.status, JSON.stringify(wrong.body).slice(0, 160));

const right = await req('POST', `/api/crm/invoices/${id}/send-email`, {});
console.log('SERVER PATH   POST /api/crm/invoices/:id/send-email  ->', right.status, JSON.stringify(right.body).slice(0, 160));

// is there ANY /api/invoices mount at all?
const list = await req('GET', '/api/invoices');
console.log('GET /api/invoices ->', list.status, JSON.stringify(list.body).slice(0, 160));
