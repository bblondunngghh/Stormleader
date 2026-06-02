// QA UI consistency audit — walks every page, collects icon/button/header/form metrics
// Usage: node .qa-ui-audit.mjs
// Outputs: .qa-ui-audit-results.json
import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';

const BASE = 'http://localhost:5173';
const API = 'http://localhost:3001';
const EMAIL = 'waterlooconstruction1@gmail.com';
const PASSWORD = '2Wealth&health';

const ROUTES = [
  '/', '/pipeline', '/leads', '/storm-map', '/storm-catalog',
  '/alerts', '/tasks', '/calendar', '/canvassing', '/estimates',
  '/invoices', '/reports', '/materials', '/work-orders', '/contracts',
  '/expenses', '/subcontractors', '/settings', '/admin',
];

async function login() {
  const r = await fetch(`${API}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD, tenantSlug: 'waterloo' }),
  });
  if (!r.ok) throw new Error('login failed ' + r.status);
  const j = await r.json();
  return j.accessToken || j.token;
}

const token = await login();
console.log('logged in');

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();

page.on('pageerror', e => console.error('PAGEERR', e.message));

// Seed localStorage with token via init script before any nav
await ctx.addInitScript(t => { try { localStorage.setItem('token', t); } catch (e) {} }, token);
await page.goto(BASE, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(500);

const results = {};

for (const route of ROUTES) {
  try {
    await page.goto(`${BASE}${route}`, { waitUntil: 'networkidle', timeout: 15000 });
  } catch (e) {
    results[route] = { error: e.message.slice(0, 120) };
    continue;
  }
  await page.waitForTimeout(700);

  const data = await page.evaluate(() => {
    // Icons
    const svgs = [...document.querySelectorAll('svg')];
    let iconHero = 0, iconOther = 0;
    const iconOtherSamples = [];
    svgs.forEach(s => {
      const fill = s.getAttribute('fill') || '';
      const stroke = s.getAttribute('stroke') || '';
      const vb = s.getAttribute('viewBox') || '';
      const cls = s.getAttribute('class') || '';
      const w = s.getAttribute('width') || '';
      const isHeroOutline = vb === '0 0 24 24' && fill === 'none' && stroke === 'currentColor';
      // Skip decorative map markers (small custom viewBoxes, explicit fill colors)
      const looksLikeMapDeco = (vb && vb !== '0 0 24 24' && fill && fill !== 'currentColor' && fill !== 'none');
      if (isHeroOutline) iconHero++;
      else if (!looksLikeMapDeco) {
        iconOther++;
        if (iconOtherSamples.length < 4)
          iconOtherSamples.push({ vb, fill: fill.slice(0,30), stroke: stroke.slice(0,30), w, cls: cls.slice(0,40), html: s.outerHTML.slice(0, 200) });
      }
    });

    // Buttons
    const buttons = [...document.querySelectorAll('button')].filter(b => {
      // Skip hidden buttons
      const r = b.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    });
    const btnData = buttons.map(b => {
      const cs = getComputedStyle(b);
      return {
        cls: (b.className || '').slice(0, 80),
        h: Math.round(parseFloat(cs.height)),
        pad: cs.padding,
        fs: cs.fontSize,
        br: cs.borderRadius,
        fw: cs.fontWeight,
        bg: cs.backgroundColor,
        col: cs.color,
        text: (b.textContent || '').trim().slice(0, 30),
      };
    });

    // Header / top toolbar (top bar at top of page)
    let header = null;
    const headerEl = document.querySelector('.top-bar, .toolbar, .page-header, header');
    if (headerEl) {
      const r = headerEl.getBoundingClientRect();
      const cs = getComputedStyle(headerEl);
      header = { tag: headerEl.tagName, cls: (headerEl.className||'').slice(0,80), h: Math.round(r.height), bg: cs.backgroundColor };
    }

    // Form elements
    const inputs = [...document.querySelectorAll('input:not([type=hidden]):not([type=checkbox]):not([type=radio]):not([type=submit]):not([type=button]):not([type=file]):not([type=color])')];
    const selects = [...document.querySelectorAll('select')];
    const textareas = [...document.querySelectorAll('textarea')];
    const dateInputs = [...document.querySelectorAll('input[type=date], input[type=datetime-local], input[type=time]')];
    const inputData = inputs.map(i => {
      const cs = getComputedStyle(i);
      return {
        type: i.type,
        cls: (i.className||'').slice(0,60),
        hasFormInput: i.classList.contains('form-input'),
        h: Math.round(parseFloat(cs.height)),
        pad: cs.padding,
        br: cs.borderRadius,
        bg: cs.backgroundColor,
      };
    });

    // Glass panels & gaps
    const glassPanels = [...document.querySelectorAll('.glass')].map(g => {
      const cs = getComputedStyle(g);
      const r = g.getBoundingClientRect();
      return {
        cls: (g.className||'').slice(0,60),
        h: Math.round(r.height),
        pad: cs.padding,
        br: cs.borderRadius,
        bg: cs.backgroundColor,
        backdrop: cs.backdropFilter,
      };
    });

    return {
      title: document.title,
      iconHero, iconOther, iconOtherSamples,
      btnCount: buttons.length,
      btnData: btnData.slice(0, 50),
      header,
      inputCount: inputs.length,
      selectCount: selects.length,
      textareaCount: textareas.length,
      dateInputCount: dateInputs.length,
      inputData: inputData.slice(0, 20),
      glassCount: glassPanels.length,
      glassSamples: glassPanels.slice(0, 5),
    };
  });

  results[route] = data;
  console.log(`${route}: icons hero=${data.iconHero} other=${data.iconOther} | btns=${data.btnCount} | inputs=${data.inputCount} selects=${data.selectCount} dates=${data.dateInputCount} | glass=${data.glassCount} | header h=${data.header?.h}`);
}

writeFileSync('.qa-ui-audit-results.json', JSON.stringify(results, null, 2));
await browser.close();
console.log('done -> .qa-ui-audit-results.json');
