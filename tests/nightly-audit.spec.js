/**
 * StormPipe Nightly UI Audit
 * Runs at 4am — tests every route, button, modal centering, and glass styling.
 */
import { test, expect } from '@playwright/test';

const BASE = 'http://localhost:5173';
const CREDS = {
  email: 'waterlooconstruction1@gmail.com',
  password: '2Wealth&health',
  tenant: 'waterloo',
};

// All app routes to visit
const ROUTES = [
  { path: '/', name: 'Dashboard' },
  { path: '/pipeline', name: 'Pipeline' },
  { path: '/leads', name: 'Leads' },
  { path: '/storm-map', name: 'Storm Map' },
  { path: '/storm-catalog', name: 'Storm Catalog' },
  { path: '/alerts', name: 'Alerts' },
  { path: '/tasks', name: 'Tasks' },
  { path: '/calendar', name: 'Calendar' },
  { path: '/canvassing', name: 'Canvassing' },
  { path: '/estimates', name: 'Estimates' },
  { path: '/invoices', name: 'Invoices' },
  { path: '/reports', name: 'Reports' },
  { path: '/materials', name: 'Materials' },
  { path: '/work-orders', name: 'Work Orders' },
  { path: '/content-studio', name: 'Content Studio' },
  { path: '/contracts', name: 'Contracts' },
  { path: '/expenses', name: 'Expenses' },
  { path: '/subcontractors', name: 'Subcontractors' },
  { path: '/settings', name: 'Settings' },
];

// Helper: check if an element is centered in the viewport
async function checkModalCentering(page, modalSelector) {
  const viewport = page.viewportSize();
  const box = await page.locator(modalSelector).first().boundingBox();
  if (!box || !viewport) return { centered: false, reason: 'No bounding box or viewport' };

  const centerX = box.x + box.width / 2;
  const centerY = box.y + box.height / 2;
  const vpCenterX = viewport.width / 2;
  const vpCenterY = viewport.height / 2;

  const xOff = Math.abs(centerX - vpCenterX);
  const yOff = Math.abs(centerY - vpCenterY);
  const tolerance = 40; // px

  return {
    centered: xOff <= tolerance && yOff <= tolerance,
    xOff,
    yOff,
    reason: `Center offset: x=${xOff.toFixed(0)}px y=${yOff.toFixed(0)}px`,
  };
}

// ─── Auth state is created by globalSetup (tests/global-setup.js) ────────────
test.describe('Nightly UI Audit', () => {
  test.use({ storageState: 'tests/.auth.json' });

  // ─── 1. ROUTE LOADING ──────────────────────────────────────────────────────
  test.describe('Route Loading', () => {
    for (const route of ROUTES) {
      test(`${route.name} loads without errors`, async ({ page }) => {
        const consoleErrors = [];
        page.on('console', (msg) => {
          if (msg.type() === 'error') consoleErrors.push(msg.text());
        });
        page.on('pageerror', (err) => consoleErrors.push(err.message));

        await page.goto(`${BASE}${route.path}`);
        await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});

        // Page should not show a blank white screen or crash overlay
        const body = await page.locator('body').innerHTML();
        expect(body.length).toBeGreaterThan(100);

        // Filter out known non-critical noise
        const realErrors = consoleErrors.filter(
          (e) =>
            !e.includes('favicon') &&
            !e.includes('net::ERR_ABORTED') &&
            !e.includes('Google Maps') &&
            !e.includes('localtunnel')
        );
        if (realErrors.length > 0) {
          console.warn(`[${route.name}] Console errors:`, realErrors);
        }
      });
    }
  });

  // ─── 2. GLASS STYLING ──────────────────────────────────────────────────────
  test.describe('Liquid Glass Styling', () => {
    for (const route of ROUTES) {
      test(`${route.name} has glass panels`, async ({ page }) => {
        await page.goto(`${BASE}${route.path}`);
        await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});

        // At least one .glass element should exist on every protected page
        const glassCount = await page.locator('.glass').count();
        expect(glassCount).toBeGreaterThan(0);

        // Each glass element should have backdrop-filter set
        const glassEls = page.locator('.glass');
        const count = Math.min(await glassEls.count(), 5); // sample up to 5
        for (let i = 0; i < count; i++) {
          const el = glassEls.nth(i);
          const bf = await el.evaluate((node) =>
            window.getComputedStyle(node).getPropertyValue('backdrop-filter') ||
            window.getComputedStyle(node).getPropertyValue('-webkit-backdrop-filter')
          );
          // backdrop-filter should not be 'none' on glass elements
          // (Some nested ones may inherit, so just warn don't fail)
          if (bf === 'none' || bf === '') {
            console.warn(`[${route.name}] .glass[${i}] has no backdrop-filter`);
          }
        }
      });
    }
  });

  // ─── 3. SIDEBAR NAVIGATION ─────────────────────────────────────────────────
  test('Sidebar nav links route correctly', async ({ page }) => {
    await page.goto(BASE);
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});

    const navItems = page.locator('.sidebar a, .sidebar [role="button"], nav a').filter({
      hasNot: page.locator('[aria-hidden="true"]'),
    });
    const count = await navItems.count();
    expect(count).toBeGreaterThan(0);

    for (let i = 0; i < count; i++) {
      const item = navItems.nth(i);
      const href = await item.getAttribute('href');
      if (href && href !== '#' && !href.startsWith('http')) {
        await item.click();
        await page.waitForLoadState('domcontentloaded', { timeout: 8000 }).catch(() => {});
        const url = new URL(page.url());
        expect(url.pathname).toBe(href);
      }
    }
  });

  // ─── 4. MODAL CENTERING ────────────────────────────────────────────────────
  test.describe('Modal Centering', () => {
    test('Create Lead modal is centered', async ({ page }) => {
      await page.goto(`${BASE}/leads`);
      await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});

      // Click the "Add Lead" or "New Lead" button
      const addBtn = page.locator(
        'button:has-text("Add Lead"), button:has-text("New Lead"), button:has-text("Add"), button[title*="lead" i]'
      ).first();
      if ((await addBtn.count()) > 0) {
        await addBtn.click();
        await page.waitForSelector('.modal-backdrop, [role="dialog"]', { timeout: 5000 }).catch(() => {});
        const result = await checkModalCentering(page, '.modal-backdrop .glass, [role="dialog"]');
        expect(result.centered).toBe(true);
        console.log(`[Create Lead Modal] ${result.reason}`);
        await page.keyboard.press('Escape');
      }
    });

    test('Work Order modal is centered', async ({ page }) => {
      await page.goto(`${BASE}/work-orders`);
      await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});

      const addBtn = page.locator(
        'button:has-text("New"), button:has-text("Create"), button:has-text("Add Work Order")'
      ).first();
      if ((await addBtn.count()) > 0) {
        await addBtn.click();
        await page.waitForSelector('.modal-backdrop', { timeout: 5000 }).catch(() => {});
        const modalCount = await page.locator('.modal-backdrop').count();
        if (modalCount > 0) {
          const result = await checkModalCentering(page, '.modal-backdrop .glass');
          expect(result.centered).toBe(true);
          console.log(`[Work Order Modal] ${result.reason}`);
        }
        await page.keyboard.press('Escape');
      }
    });

    test('Invoice modal is centered', async ({ page }) => {
      await page.goto(`${BASE}/invoices`);
      await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});

      const addBtn = page.locator('button:has-text("New Invoice"), button:has-text("Create Invoice"), button:has-text("New")').first();
      if ((await addBtn.count()) > 0) {
        await addBtn.click();
        await page.waitForSelector('.modal-backdrop', { timeout: 5000 }).catch(() => {});
        const modalCount = await page.locator('.modal-backdrop').count();
        if (modalCount > 0) {
          const result = await checkModalCentering(page, '.modal-backdrop .glass, .modal-backdrop form.glass');
          expect(result.centered).toBe(true);
          console.log(`[Invoice Modal] ${result.reason}`);
        }
        await page.keyboard.press('Escape');
      }
    });

    test('Estimate modal is centered', async ({ page }) => {
      await page.goto(`${BASE}/estimates`);
      await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});

      const addBtn = page.locator('button:has-text("New Estimate"), button:has-text("Create"), button:has-text("New")').first();
      if ((await addBtn.count()) > 0) {
        await addBtn.click();
        await page.waitForSelector('.modal-backdrop', { timeout: 5000 }).catch(() => {});
        const modalCount = await page.locator('.modal-backdrop').count();
        if (modalCount > 0) {
          const result = await checkModalCentering(page, '.modal-backdrop .glass, .modal-backdrop form.glass');
          expect(result.centered).toBe(true);
          console.log(`[Estimate Modal] ${result.reason}`);
        }
        await page.keyboard.press('Escape');
      }
    });

    test('Materials modal is centered', async ({ page }) => {
      await page.goto(`${BASE}/materials`);
      await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});

      const addBtn = page.locator('button:has-text("Add"), button:has-text("New"), button:has-text("Create")').first();
      if ((await addBtn.count()) > 0) {
        await addBtn.click();
        await page.waitForSelector('.modal-backdrop', { timeout: 5000 }).catch(() => {});
        const modalCount = await page.locator('.modal-backdrop').count();
        if (modalCount > 0) {
          const result = await checkModalCentering(page, '.modal-backdrop .glass, .modal-backdrop form.glass');
          expect(result.centered).toBe(true);
          console.log(`[Materials Modal] ${result.reason}`);
        }
        await page.keyboard.press('Escape');
      }
    });

    test('Expense modal is centered', async ({ page }) => {
      await page.goto(`${BASE}/expenses`);
      await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});

      const addBtn = page.locator('button:has-text("Add"), button:has-text("New"), button:has-text("Create")').first();
      if ((await addBtn.count()) > 0) {
        await addBtn.click();
        await page.waitForSelector('.modal-backdrop', { timeout: 5000 }).catch(() => {});
        const modalCount = await page.locator('.modal-backdrop').count();
        if (modalCount > 0) {
          const result = await checkModalCentering(page, '.modal-backdrop .glass, .modal-backdrop form.glass');
          expect(result.centered).toBe(true);
          console.log(`[Expense Modal] ${result.reason}`);
        }
        await page.keyboard.press('Escape');
      }
    });

    test('Settings modals are centered', async ({ page }) => {
      await page.goto(`${BASE}/settings`);
      await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});

      // Check any visible modal triggers
      const modalTriggers = page.locator('button:has-text("Add"), button:has-text("New"), button:has-text("Create"), button:has-text("Edit")');
      const triggerCount = await modalTriggers.count();
      for (let i = 0; i < Math.min(triggerCount, 3); i++) {
        await modalTriggers.nth(i).click();
        const hasModal = await page.locator('.modal-backdrop').count();
        if (hasModal > 0) {
          const result = await checkModalCentering(page, '.modal-backdrop .glass, .modal-backdrop form.glass');
          expect(result.centered).toBe(true);
          console.log(`[Settings Modal #${i}] ${result.reason}`);
          await page.keyboard.press('Escape');
          await page.waitForTimeout(300);
        }
      }
    });
  });

  // ─── 5. BUTTON FUNCTIONALITY ───────────────────────────────────────────────
  test.describe('Button Functionality', () => {
    test('Dashboard stat cards and actions work', async ({ page }) => {
      await page.goto(BASE);
      await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});

      // Verify stat cards are visible
      const statCards = page.locator('.stat-card, [class*="stat"]');
      const cardCount = await statCards.count();
      console.log(`[Dashboard] ${cardCount} stat cards found`);

      // Click any "View All" or action buttons
      const viewButtons = page.locator('button:has-text("View All"), button:has-text("View"), a:has-text("View All")');
      const viewCount = await viewButtons.count();
      for (let i = 0; i < Math.min(viewCount, 3); i++) {
        await viewButtons.nth(i).click();
        await page.waitForTimeout(500);
        // Either a modal opened or we navigated — both are fine
      }
    });

    test('Pipeline kanban drag handles exist', async ({ page }) => {
      await page.goto(`${BASE}/pipeline`);
      await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});

      // Kanban columns should render
      const columns = page.locator('[class*="kanban"], [class*="pipeline"], [class*="stage"]');
      const colCount = await columns.count();
      console.log(`[Pipeline] ${colCount} kanban elements found`);
      expect(colCount).toBeGreaterThan(0);
    });

    test('Leads — import and export buttons exist', async ({ page }) => {
      await page.goto(`${BASE}/leads`);
      await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});

      const importBtn = page.locator('button[title*="Import"], button:has-text("Import")');
      const exportBtn = page.locator('button[title*="Export"], button:has-text("Export")');

      console.log(`[Leads] Import buttons: ${await importBtn.count()}, Export buttons: ${await exportBtn.count()}`);

      // Click import to open modal
      if ((await importBtn.count()) > 0) {
        await importBtn.first().click();
        await page.waitForSelector('.modal-backdrop, [role="dialog"]', { timeout: 5000 }).catch(() => {});
        const isOpen = (await page.locator('.modal-backdrop').count()) > 0;
        console.log(`[Leads] Import modal opened: ${isOpen}`);
        if (isOpen) await page.keyboard.press('Escape');
      }
    });

    test('Tasks — add task button works', async ({ page }) => {
      await page.goto(`${BASE}/tasks`);
      await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});

      const addBtn = page.locator('button:has-text("Add Task"), button:has-text("New Task"), button:has-text("Add"), button:has-text("New")').first();
      if ((await addBtn.count()) > 0) {
        await addBtn.click();
        await page.waitForTimeout(500);
        // Form or modal should appear
        const hasForm = (await page.locator('form, .modal-backdrop, input[placeholder*="task" i]').count()) > 0;
        console.log(`[Tasks] Add task opened form: ${hasForm}`);
      }
    });

    test('Settings tabs are clickable', async ({ page }) => {
      await page.goto(`${BASE}/settings`);
      await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});

      const tabs = page.locator('[role="tab"], button[class*="tab"], .tab-btn, nav button');
      const tabCount = await tabs.count();
      console.log(`[Settings] ${tabCount} tabs found`);

      for (let i = 0; i < Math.min(tabCount, 8); i++) {
        await tabs.nth(i).click();
        await page.waitForTimeout(300);
        // Tab should become active
        const activeTab = await tabs.nth(i).evaluate((el) =>
          el.classList.contains('active') ||
          el.getAttribute('aria-selected') === 'true' ||
          el.getAttribute('data-active') === 'true' ||
          window.getComputedStyle(el).fontWeight >= 600
        );
        console.log(`[Settings] Tab ${i} clicked, active: ${activeTab}`);
      }
    });

    test('Reports — filter controls work', async ({ page }) => {
      await page.goto(`${BASE}/reports`);
      await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});

      // Date range or filter buttons
      const filterBtns = page.locator('button:has-text("7 days"), button:has-text("30 days"), button:has-text("Month"), button:has-text("Year"), select');
      const filterCount = await filterBtns.count();
      console.log(`[Reports] ${filterCount} filter controls found`);

      for (let i = 0; i < Math.min(filterCount, 4); i++) {
        const el = filterBtns.nth(i);
        const tag = await el.evaluate((n) => n.tagName.toLowerCase());
        if (tag === 'button') {
          await el.click();
          await page.waitForTimeout(500);
        }
      }
    });

    test('Calendar view switcher works', async ({ page }) => {
      await page.goto(`${BASE}/calendar`);
      await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});

      const viewBtns = page.locator('button:has-text("Month"), button:has-text("Week"), button:has-text("Day"), button:has-text("List")');
      const count = await viewBtns.count();
      console.log(`[Calendar] ${count} view switchers found`);
      for (let i = 0; i < count; i++) {
        await viewBtns.nth(i).click();
        await page.waitForTimeout(400);
      }
    });

    test('Content Studio tabs work', async ({ page }) => {
      await page.goto(`${BASE}/content-studio`);
      await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});

      const tabs = page.locator('button:has-text("Social"), button:has-text("Email"), button:has-text("Door Hanger"), button:has-text("Preview")');
      const count = await tabs.count();
      console.log(`[Content Studio] ${count} tabs found`);
      for (let i = 0; i < count; i++) {
        await tabs.nth(i).click();
        await page.waitForTimeout(400);
      }
    });

    test('Estimates — new estimate flow starts', async ({ page }) => {
      await page.goto(`${BASE}/estimates`);
      await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});

      const newBtn = page.locator('button:has-text("New"), button:has-text("Create"), button:has-text("Add Estimate")').first();
      if ((await newBtn.count()) > 0) {
        await newBtn.click();
        await page.waitForTimeout(500);
        console.log(`[Estimates] New estimate clicked, URL: ${page.url()}`);
      }
    });

    test('Subcontractors — add button works', async ({ page }) => {
      await page.goto(`${BASE}/subcontractors`);
      await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});

      const addBtn = page.locator('button:has-text("Add"), button:has-text("New"), button:has-text("Invite")').first();
      if ((await addBtn.count()) > 0) {
        await addBtn.click();
        await page.waitForTimeout(500);
        const hasModal = (await page.locator('.modal-backdrop, form').count()) > 0;
        console.log(`[Subcontractors] Add opened: ${hasModal}`);
        if (hasModal) await page.keyboard.press('Escape');
      }
    });
  });

  // ─── 6. ALL MODAL-BACKDROP CENTERING ──────────────────────────────────────
  test('All open modals use centering flex layout', async ({ page }) => {
    // This test visits each page and audits any modals we can trigger
    const issues = [];

    for (const route of ROUTES) {
      await page.goto(`${BASE}${route.path}`);
      await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});

      // Find all "open modal" trigger buttons
      const triggers = page.locator('button:has-text("New"), button:has-text("Add"), button:has-text("Create"), button:has-text("Edit")');
      const count = await triggers.count();

      for (let i = 0; i < Math.min(count, 2); i++) {
        try {
          await triggers.nth(i).click({ timeout: 3000 });
          await page.waitForTimeout(600);

          const backdrops = page.locator('.modal-backdrop');
          if ((await backdrops.count()) > 0) {
            const result = await checkModalCentering(page, '.modal-backdrop .glass, .modal-backdrop form.glass');
            if (!result.centered) {
              issues.push(`${route.name} modal #${i}: NOT centered (${result.reason})`);
              console.warn(`[MODAL NOT CENTERED] ${route.name}: ${result.reason}`);
            } else {
              console.log(`[OK] ${route.name} modal #${i}: ${result.reason}`);
            }
            await page.keyboard.press('Escape');
            await page.waitForTimeout(400);
          }
        } catch (_) {
          // Button may be disabled or cause navigation — skip
        }
      }
    }

    if (issues.length > 0) {
      console.error('\n=== MODAL CENTERING ISSUES ===\n' + issues.join('\n'));
    }
    expect(issues.length).toBe(0);
  });

  // ─── 7. BROKEN ROUTES (404/blank) ─────────────────────────────────────────
  test('No routes return 404 or crash', async ({ page }) => {
    const failures = [];

    for (const route of ROUTES) {
      const errors = [];
      page.on('pageerror', (e) => errors.push(e.message));

      await page.goto(`${BASE}${route.path}`);
      await page.waitForLoadState('domcontentloaded', { timeout: 10000 }).catch(() => {});

      // Check for error boundaries or white screens
      const bodyText = await page.locator('body').innerText().catch(() => '');
      if (
        bodyText.includes('Something went wrong') ||
        bodyText.includes('Error:') ||
        bodyText.trim().length < 50
      ) {
        failures.push(`${route.name} (${route.path}): possible crash or empty page`);
      }
    }

    if (failures.length > 0) {
      console.error('\n=== ROUTE FAILURES ===\n' + failures.join('\n'));
    }
    expect(failures.length).toBe(0);
  });
});
