// Screenshot two modals side-by-side for visual comparison
import { chromium } from 'playwright';
const BASE = 'http://localhost:5173';
const API = 'http://localhost:3001';

async function login() {
  const r = await fetch(`${API}/api/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'waterlooconstruction1@gmail.com', password: '2Wealth&health', tenantSlug: 'waterloo' }),
  });
  const j = await r.json();
  return j.accessToken || j.token;
}

const token = await login();
const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
await ctx.addInitScript(t => { localStorage.setItem('token', t); }, token);

// Pipeline → Add Lead modal (z=300 standard)
await page.goto(`${BASE}/pipeline`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2000);
await page.evaluate(() => {
  const btn = [...document.querySelectorAll('button')].find(b => (b.textContent||'').includes('Add Lead'));
  if (btn) btn.click();
});
await page.waitForTimeout(500);
await page.screenshot({ path: 'qa-run39-modal-pipeline.png' });
console.log('saved qa-run39-modal-pipeline.png');

// Leads → Import Leads modal (z=9999 variant)
await page.goto(`${BASE}/leads`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2000);
await page.evaluate(() => {
  const btn = [...document.querySelectorAll('button')].find(b => (b.textContent||'').includes('Import'));
  if (btn) btn.click();
});
await page.waitForTimeout(500);
await page.screenshot({ path: 'qa-run39-modal-import.png' });
console.log('saved qa-run39-modal-import.png');

await browser.close();
