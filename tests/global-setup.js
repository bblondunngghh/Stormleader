/**
 * Playwright global setup — logs in once and saves auth state to tests/.auth.json
 */
import { chromium } from '@playwright/test';

const BASE = 'http://localhost:5173';
const CREDS = {
  email: 'waterlooconstruction1@gmail.com',
  password: '2Wealth&health',
  tenant: 'waterloo',
};

export default async function globalSetup() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  await page.goto(`${BASE}/login`);
  // Login form uses React controlled inputs — defaults are already pre-filled,
  // but we clear and fill each field explicitly for reliability.
  await page.waitForSelector('input[placeholder="username"]', { timeout: 15000 });

  // Email field (placeholder="username"), Password, Tenant (placeholder="creekstone")
  await page.fill('input[placeholder="username"]', CREDS.email);
  await page.fill('input[type="password"]', CREDS.password);
  await page.fill('input[placeholder="creekstone"]', CREDS.tenant);

  await page.click('button.auth-btn[type="submit"]');
  await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 15000 });

  await page.context().storageState({ path: 'tests/.auth.json' });
  await browser.close();
}
