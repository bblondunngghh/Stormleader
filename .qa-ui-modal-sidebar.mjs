// Verify sidebar consistency + open modals to check pattern
import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';

const BASE = 'http://localhost:5173';
const API = 'http://localhost:3001';
const EMAIL = 'waterlooconstruction1@gmail.com';
const PASSWORD = '2Wealth&health';

async function login() {
  const r = await fetch(`${API}/api/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD, tenantSlug: 'waterloo' }),
  });
  const j = await r.json();
  return j.accessToken || j.token;
}

const token = await login();
const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
await ctx.addInitScript(t => { try { localStorage.setItem('token', t); } catch (e) {} }, token);

const out = { sidebar: {}, modals: {} };

// --- SIDEBAR: visit 4 representative pages and snapshot the sidebar ---
const sidebarRoutes = ['/pipeline', '/leads', '/estimates', '/settings'];
for (const route of sidebarRoutes) {
  await page.goto(`${BASE}${route}`, { waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.waitForTimeout(1500);
  const data = await page.evaluate(() => {
    const sb = document.querySelector('.sidebar, aside, [class*="sidebar"]');
    if (!sb) return { found: false };
    const r = sb.getBoundingClientRect();
    const cs = getComputedStyle(sb);
    const links = [...sb.querySelectorAll('.nav-link')];
    const activeLinks = [...sb.querySelectorAll('.nav-link.is-active, .nav-link[aria-current]')];
    const linkHeights = links.slice(0, 5).map(l => Math.round(l.getBoundingClientRect().height));
    return {
      found: true,
      cls: (sb.className||'').slice(0,80),
      w: Math.round(r.width),
      h: Math.round(r.height),
      bg: cs.backgroundColor,
      linkCount: links.length,
      activeCount: activeLinks.length,
      activeText: activeLinks[0]?.textContent?.trim().slice(0,30),
      linkHeights,
    };
  });
  out.sidebar[route] = data;
  console.log('sidebar', route, JSON.stringify(data));
}

// --- MODALS: open one modal on each page that has one ---
// Pipeline: click "Add Lead" / FAB
async function tryModal(route, openerSelector) {
  try {
    await page.goto(`${BASE}${route}`, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForTimeout(1500);
    const opened = await page.evaluate((sel) => {
      const candidates = sel.split('|||');
      for (const c of candidates) {
        const el = document.querySelector(c);
        if (el) { el.click(); return c; }
      }
      return null;
    }, openerSelector);
    await page.waitForTimeout(700);
    const modalInfo = await page.evaluate(() => {
      const m = document.querySelector('.modal-backdrop');
      if (!m) return { found: false };
      const cs = getComputedStyle(m);
      const child = m.querySelector('.glass, [class*="modal"]');
      const childCs = child ? getComputedStyle(child) : null;
      const childRect = child ? child.getBoundingClientRect() : null;
      // Find close button — common patterns
      const closeBtn = m.querySelector('button[aria-label*="close" i], button[aria-label*="Close"], .modal-close, button.close');
      return {
        found: true,
        cls: m.className,
        zIndex: cs.zIndex,
        animation: cs.animationName,
        bg: cs.backgroundColor,
        childCls: child?.className?.slice(0,80),
        childAnim: childCs?.animationName,
        childW: Math.round(childRect?.width||0),
        childH: Math.round(childRect?.height||0),
        childBR: childCs?.borderRadius,
        closeBtn: !!closeBtn,
      };
    });
    out.modals[route] = { opener: opened, ...modalInfo };
    console.log('modal', route, JSON.stringify(out.modals[route]).slice(0, 280));
    // close it (press Esc)
    await page.keyboard.press('Escape');
    await page.waitForTimeout(400);
  } catch (e) {
    out.modals[route] = { error: e.message.slice(0, 120) };
  }
}

await tryModal('/pipeline', 'button.pipeline-fab|||button[aria-label*="Add Lead" i]|||button:has-text("Add Lead")');
await tryModal('/leads', 'button:has-text("Import")|||button[aria-label*="Import" i]');
await tryModal('/tasks', 'button:has-text("New Task")|||button:has-text("Add Task")|||button[aria-label*="Create" i]');
await tryModal('/estimates', 'button:has-text("New Estimate")|||button:has-text("New")');
await tryModal('/expenses', 'button:has-text("Add Expense")|||button:has-text("New")');
await tryModal('/invoices', 'button:has-text("New Invoice")|||button:has-text("Create")');
await tryModal('/settings', 'button:has-text("Invite")|||button:has-text("Add")');

writeFileSync('.qa-ui-modal-sidebar.json', JSON.stringify(out, null, 2));
await browser.close();
console.log('done');
