// Probe dashboard route only — domcontentloaded waits, longer timeout
import { chromium } from 'playwright';
import { writeFileSync, readFileSync } from 'node:fs';

const BASE = 'http://localhost:5173';
const API = 'http://localhost:3001';
const EMAIL = 'waterlooconstruction1@gmail.com';
const PASSWORD = '2Wealth&health';

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
const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
await ctx.addInitScript(t => { try { localStorage.setItem('token', t); } catch (e) {} }, token);
await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 30000 });
await page.waitForTimeout(2500);

const data = await page.evaluate(() => {
  const svgs = [...document.querySelectorAll('svg')];
  let iconHero = 0, iconOther = 0;
  const iconOtherSamples = [];
  svgs.forEach(s => {
    const fill = s.getAttribute('fill') || '';
    const stroke = s.getAttribute('stroke') || '';
    const vb = s.getAttribute('viewBox') || '';
    const cls = s.getAttribute('class') || '';
    const isHeroOutline = vb === '0 0 24 24' && fill === 'none' && stroke === 'currentColor';
    const looksLikeMapDeco = (vb && vb !== '0 0 24 24' && fill && fill !== 'currentColor' && fill !== 'none');
    if (isHeroOutline) iconHero++;
    else if (!looksLikeMapDeco) {
      iconOther++;
      if (iconOtherSamples.length < 4)
        iconOtherSamples.push({ vb, fill, stroke, cls, html: s.outerHTML.slice(0, 200) });
    }
  });

  const buttons = [...document.querySelectorAll('button')].filter(b => {
    const r = b.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  });
  const btnData = buttons.map(b => {
    const cs = getComputedStyle(b);
    return { cls: (b.className || '').slice(0, 80), h: Math.round(parseFloat(cs.height)), br: cs.borderRadius, bg: cs.backgroundColor };
  });

  const headerEl = document.querySelector('.top-bar, .toolbar, .page-header, header');
  let header = null;
  if (headerEl) {
    const r = headerEl.getBoundingClientRect();
    const cs = getComputedStyle(headerEl);
    header = { tag: headerEl.tagName, cls: (headerEl.className||'').slice(0,80), h: Math.round(r.height), bg: cs.backgroundColor };
  }

  const inputs = [...document.querySelectorAll('input:not([type=hidden]):not([type=checkbox]):not([type=radio]):not([type=submit]):not([type=button]):not([type=file]):not([type=color])')];
  const selects = [...document.querySelectorAll('select')];
  const dateInputs = [...document.querySelectorAll('input[type=date], input[type=datetime-local], input[type=time]')];

  const glassPanels = [...document.querySelectorAll('.glass')].map(g => {
    const cs = getComputedStyle(g);
    return { cls: (g.className||'').slice(0,60), pad: cs.padding, br: cs.borderRadius };
  });

  return {
    iconHero, iconOther, iconOtherSamples,
    btnCount: buttons.length, btnData: btnData.slice(0,50),
    header,
    inputCount: inputs.length, selectCount: selects.length, dateInputCount: dateInputs.length,
    glassCount: glassPanels.length, glassSamples: glassPanels.slice(0,5),
  };
});

console.log(`/: icons hero=${data.iconHero} other=${data.iconOther} | btns=${data.btnCount} | inputs=${data.inputCount} selects=${data.selectCount} dates=${data.dateInputCount} | glass=${data.glassCount} | header h=${data.header?.h}`);
if (data.iconOther > 0) console.log('OTHER samples:', JSON.stringify(data.iconOtherSamples, null, 2));

// Merge into main results
const existing = JSON.parse(readFileSync('.qa-ui-audit-results.json', 'utf8'));
existing['/'] = data;
writeFileSync('.qa-ui-audit-results.json', JSON.stringify(existing, null, 2));

await browser.close();
