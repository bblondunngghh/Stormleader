// Open one modal per page and inspect pattern (fixed text matching)
import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';

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

const out = {};

async function tryOpen(route, textOptions) {
  try {
    await page.goto(`${BASE}${route}`, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForTimeout(1800);
    const clicked = await page.evaluate((texts) => {
      const buttons = [...document.querySelectorAll('button')];
      for (const t of texts) {
        const lt = t.toLowerCase();
        const btn = buttons.find(b => (b.textContent||'').toLowerCase().includes(lt) && b.offsetParent !== null);
        if (btn) { btn.click(); return t; }
      }
      return null;
    }, textOptions);
    if (!clicked) { out[route] = { error: 'no opener found' }; return; }
    await page.waitForTimeout(700);
    const info = await page.evaluate(() => {
      const m = document.querySelector('.modal-backdrop');
      if (!m) {
        // Maybe portal — check body for any newly added z-300+ overlay
        const overlays = [...document.querySelectorAll('div')].filter(d => {
          const cs = getComputedStyle(d);
          return cs.position === 'fixed' && parseInt(cs.zIndex) >= 100 && d.getBoundingClientRect().width > 200;
        });
        return { found: false, overlays: overlays.length };
      }
      const cs = getComputedStyle(m);
      const child = m.querySelector('.glass');
      const childCs = child ? getComputedStyle(child) : null;
      const childRect = child ? child.getBoundingClientRect() : null;
      const closeBtn = m.querySelector('button[aria-label*="close" i], button[aria-label*="Close"], .modal-close');
      // Title typically lives in h2/h3 inside the modal
      const titleEl = m.querySelector('h1, h2, h3, .modal-title');
      return {
        found: true,
        bdCls: m.className,
        bdZ: cs.zIndex,
        bdAnim: cs.animationName,
        bdBg: cs.backgroundColor.slice(0, 30),
        bdPos: cs.position,
        childCls: child?.className?.slice(0,80),
        childAnim: childCs?.animationName,
        childBR: childCs?.borderRadius,
        childW: Math.round(childRect?.width||0),
        childMaxW: childCs?.maxWidth,
        closeBtn: !!closeBtn,
        title: titleEl?.textContent?.trim().slice(0,40),
      };
    });
    out[route] = { opener: clicked, ...info };
    console.log(route, JSON.stringify(out[route]).slice(0, 280));
    await page.keyboard.press('Escape');
    await page.waitForTimeout(400);
  } catch (e) {
    out[route] = { error: e.message.slice(0, 120) };
  }
}

await tryOpen('/pipeline', ['Add Lead', 'Create Lead', 'New Lead', '+']);
await tryOpen('/leads', ['Import', 'Add Lead', 'Create']);
await tryOpen('/tasks', ['New Task', 'Add Task', 'Create Task']);
await tryOpen('/estimates', ['New Estimate', 'New', 'Create']);
await tryOpen('/expenses', ['Add Expense', 'New', 'Create']);
await tryOpen('/invoices', ['New Invoice', 'Create', 'Add']);
await tryOpen('/work-orders', ['New Work Order', 'Add', 'Create']);
await tryOpen('/contracts', ['New Contract', 'Add', 'Create']);
await tryOpen('/subcontractors', ['Add Subcontractor', 'New', 'Add Sub']);
await tryOpen('/materials', ['Add Material', 'Add Item', 'New']);

writeFileSync('.qa-ui-modal-results.json', JSON.stringify(out, null, 2));
await browser.close();
