# Competitor Feature Catch-Up Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the 8 highest-priority feature gaps identified from competitor research (excludes QuickBooks sync and SMS/texting).

**Architecture:** All changes are frontend UI + minor backend additions. No new database tables needed except invoice_reminders. Follows existing patterns: glass cards, oklch colors, .form-input class, pool.query(), axios client.

**Tech Stack:** React, Express, PostgreSQL, pdfmake, nodemailer, existing automation engine

**CRITICAL CONSTRAINTS:**
- Build check after EVERY change: `cd /c/Projects/stormleads/client && npx vite build`
- Follow oklch colors, `.glass` class, `.form-input` class, dark-mode-first
- DO NOT TOUCH StormMap.jsx FEMA property loading code (tag: `map-stable-20260326`)
- Commit after each completed task

---

## Task 1: Dashboard Stat Card Drill-Down

**Goal:** Clicking dashboard stat cards navigates to filtered views instead of being display-only.

**Files:**
- Modify: `client/src/components/Dashboard.jsx`

**Context:** Stat cards already have `onClick={() => navigate(stat.link)}` (line 970) and links defined in `emptyStats` (lines 53-58). The issue is that the API response overwrites the links. The `link` property needs to survive the API merge.

- [ ] **Step 1: Check how stats merge from API**

Read `Dashboard.jsx` lines 361-368 to see how API stats merge with emptyStats. The `link` property from `emptyStats` is preserved via spread: `{ ...s, tint: emptyStats[i]?.tint, link: emptyStats[i]?.link }`. Verify this works by clicking a stat card — if it already navigates, this task is done.

- [ ] **Step 2: Add drill-down links to remaining stat sources**

If funnel chart sections, activity feed items, or task cards don't navigate, add `onClick` handlers:

In `Dashboard.jsx`, find the funnel/pipeline section. Each stage bar should be clickable:
```jsx
onClick={() => navigate(`/leads?stage=${stage.key}`)}
style={{ cursor: 'pointer' }}
```

For the tasks-due-today section, each task should navigate to the lead:
```jsx
onClick={() => navigate(`/leads/${task.lead_id}`)}
style={{ cursor: 'pointer' }}
```

For the activity feed items:
```jsx
onClick={() => task.lead_id && navigate(`/leads/${task.lead_id}`)}
style={{ cursor: 'pointer' }}
```

- [ ] **Step 3: Build check and commit**

```bash
cd /c/Projects/stormleads/client && npx vite build
git add client/src/components/Dashboard.jsx
git commit -m "feat(dashboard): add drill-down navigation from stat cards, funnel, tasks, and activity feed"
```

---

## Task 2: Good/Better/Best Estimate Tiers

**Goal:** Surface the existing backend tier generation in the estimates UI so users can generate Silver/Gold/Platinum variants.

**Files:**
- Modify: `client/src/components/EstimatesView.jsx`
- Modify: `client/src/api/estimates.js`

**Context:** Backend `estimateService.js` already has `generateTiers()` (lines 218-256) that creates 3 tiers at 85%/100%/120% multipliers. Need to expose this in the UI.

- [ ] **Step 1: Add API function for tier generation**

In `client/src/api/estimates.js`, add:
```javascript
export const generateTiers = (estimateId) =>
  client.post(`/estimates/${estimateId}/tiers`);
```

- [ ] **Step 2: Check if the backend route exists**

Search `server/src/routes/estimates.js` for a `/tiers` endpoint. If it doesn't exist, add it:
```javascript
router.post('/:id/tiers', async (req, res, next) => {
  try {
    const tiers = await estimateService.generateTiers(req.tenantId, req.user.id, req.params.id);
    res.json({ tiers });
  } catch (err) { next(err); }
});
```

- [ ] **Step 3: Add "Generate Tiers" button to estimate list**

In `EstimatesView.jsx`, find where individual estimate action buttons render (the row actions or detail view). Add a button:
```jsx
<button
  className="btn btn-secondary"
  onClick={async () => {
    try {
      const { data } = await estimatesApi.generateTiers(est.id);
      showToast(`Generated ${data.tiers.length} tier variants`, 'success');
      loadEstimates(); // refresh the list
    } catch {
      showToast('Failed to generate tiers', 'error');
    }
  }}
  style={{ fontSize: 11, padding: '4px 10px' }}
>
  Generate Tiers
</button>
```

- [ ] **Step 4: Add tier badge to estimate list rows**

In the estimate list table, show a tier badge if `est.tier_label` exists:
```jsx
{est.tier_label && (
  <span style={{
    fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 6,
    background: est.tier_label === 'Best' ? 'oklch(0.35 0.12 155 / 0.4)' :
                est.tier_label === 'Better' ? 'oklch(0.35 0.12 250 / 0.4)' :
                'oklch(0.35 0.08 260 / 0.4)',
    color: est.tier_label === 'Best' ? 'oklch(0.80 0.15 155)' :
           est.tier_label === 'Better' ? 'oklch(0.80 0.15 250)' :
           'oklch(0.70 0.05 260)',
  }}>
    {est.tier_label}
  </span>
)}
```

- [ ] **Step 5: Build check and commit**

```bash
cd /c/Projects/stormleads/client && npx vite build
git add client/src/components/EstimatesView.jsx client/src/api/estimates.js server/src/routes/estimates.js
git commit -m "feat(estimates): expose Good/Better/Best tier generation in UI"
```

---

## Task 3: Property Report Generator

**Goal:** Bundle existing data (weather history, FEMA, Census, lead scoring) into a shareable PDF property report from LeadDetail.

**Files:**
- Modify: `server/src/routes/properties.js`
- Modify: `client/src/components/LeadDetail.jsx`

**Context:** Weather History PDF already exists at `/api/properties/:id/weather-history/pdf` (properties.js lines 684-796). Extend it to include FEMA data, Census demographics, and lead score.

- [ ] **Step 1: Create comprehensive property report endpoint**

In `server/src/routes/properties.js`, add a new endpoint after the weather-history/pdf route:

```javascript
// GET /api/properties/:id/report/pdf — Comprehensive property report
router.get('/:id/report/pdf', async (req, res, next) => {
  try {
    const propId = req.params.id;

    // Fetch property + storms + FEMA + census in parallel
    const [propResult, stormResult] = await Promise.all([
      pool.query(
        `SELECT p.*, ST_Y(p.location::geometry) AS lat, ST_X(p.location::geometry) AS lng
         FROM properties p WHERE p.id = $1`,
        [propId]
      ),
      pool.query(
        `SELECT se.source, se.hail_size_max_in, se.wind_speed_max_mph,
                se.event_start, se.raw_data
         FROM storm_events se
         JOIN properties p ON p.id = $1
         WHERE ST_DWithin(se.geom::geography, p.location::geography, 8047)
         ORDER BY se.event_start DESC`,
        [propId]
      ),
    ]);

    if (!propResult.rows[0]) return res.status(404).json({ error: 'Property not found' });
    const prop = propResult.rows[0];
    const storms = stormResult.rows;

    // Fetch lead score if available
    let scoreData = null;
    const leadResult = await pool.query(
      'SELECT lead_score, lead_score_factors FROM leads WHERE property_id = $1 LIMIT 1',
      [propId]
    );
    if (leadResult.rows[0]?.lead_score) {
      scoreData = { score: leadResult.rows[0].lead_score, factors: leadResult.rows[0].lead_score_factors };
    }

    const pdfmake = require('pdfmake');
    const addr = [prop.address_line1, prop.city, prop.state, prop.zip].filter(Boolean).join(', ');

    const content = [
      { text: 'Property Report', style: 'header' },
      { text: addr || `Property ${propId}`, style: 'subheader' },
      { text: `Generated ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`, style: 'meta' },
      { text: ' ' },
    ];

    // Property Details section
    const propDetails = [];
    if (prop.year_built || prop.fema_year_built) propDetails.push(['Year Built', String(prop.year_built || prop.fema_year_built)]);
    if (prop.assessed_value || prop.fema_replacement_value) propDetails.push(['Assessed Value', `$${Number(prop.assessed_value || prop.fema_replacement_value).toLocaleString()}`]);
    if (prop.property_sqft || prop.fema_sqft) propDetails.push(['Building Sqft', Number(prop.property_sqft || prop.fema_sqft).toLocaleString()]);
    if (prop.roof_type) propDetails.push(['Roof Type', prop.roof_type]);
    if (prop.fema_bldg_type) propDetails.push(['Structure Type', prop.fema_bldg_type]);
    if (prop.fema_num_stories) propDetails.push(['Stories', String(prop.fema_num_stories)]);

    if (propDetails.length > 0) {
      content.push({ text: 'Property Details', style: 'sectionHeader' });
      content.push({
        table: { widths: [150, '*'], body: propDetails },
        layout: 'lightHorizontalLines',
      });
      content.push({ text: ' ' });
    }

    // Lead Score section
    if (scoreData) {
      content.push({ text: 'Lead Score', style: 'sectionHeader' });
      content.push({ text: `Overall Score: ${scoreData.score}/100`, bold: true, fontSize: 14 });
      content.push({ text: ' ' });
    }

    // Storm History section
    content.push({ text: `Storm History (${storms.length} events within 5 miles)`, style: 'sectionHeader' });
    if (storms.length > 0) {
      const stormRows = [['Date', 'Type', 'Hail Size (in)', 'Wind Speed (mph)', 'Source']];
      for (const s of storms.slice(0, 30)) {
        const date = s.event_start ? new Date(s.event_start).toLocaleDateString() : '—';
        const type = s.raw_data?.type || s.source;
        stormRows.push([date, type, s.hail_size_max_in || '—', s.wind_speed_max_mph || '—', s.source]);
      }
      content.push({
        table: { headerRows: 1, widths: ['auto', '*', 'auto', 'auto', 'auto'], body: stormRows },
        layout: 'lightHorizontalLines',
      });
    } else {
      content.push({ text: 'No storm events recorded within 5 miles.', italics: true, color: '#888' });
    }

    const printer = new pdfmake({
      Roboto: {
        normal: Buffer.from(''), bold: Buffer.from(''),
        italics: Buffer.from(''), bolditalics: Buffer.from(''),
      },
    });
    // Use default fonts
    const docDef = {
      content,
      defaultStyle: { fontSize: 11 },
      styles: {
        header: { fontSize: 22, bold: true, margin: [0, 0, 0, 4] },
        subheader: { fontSize: 14, color: '#555', margin: [0, 0, 0, 2] },
        meta: { fontSize: 10, color: '#888', margin: [0, 0, 0, 16] },
        sectionHeader: { fontSize: 14, bold: true, margin: [0, 12, 0, 6], color: '#1a1a2e' },
      },
    };
    const doc = printer.createPdfKitDocument(docDef);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="property-report-${propId}.pdf"`);
    doc.pipe(res);
    doc.end();
  } catch (err) { next(err); }
});
```

- [ ] **Step 2: Add "Download Property Report" button to LeadDetail**

In `LeadDetail.jsx`, find the action buttons grid area. Add a report download button:
```jsx
<button
  onClick={() => {
    if (lead?.property_id) {
      window.open(`/api/properties/${lead.property_id}/report/pdf`, '_blank');
    }
  }}
  disabled={!lead?.property_id}
  className="icon-spin-btn"
  style={{
    display: 'flex', alignItems: 'center', gap: 6,
    padding: '8px 12px', fontSize: 12, fontWeight: 600,
    background: 'oklch(0.25 0.03 260 / 0.5)', border: '1px solid oklch(0.50 0.02 260 / 0.2)',
    borderRadius: 10, color: 'oklch(0.80 0.12 200)',
    cursor: lead?.property_id ? 'pointer' : 'not-allowed',
    opacity: lead?.property_id ? 0.85 : 0.4,
  }}
>
  <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
    <path d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
  Property Report
</button>
```

- [ ] **Step 3: Build check and commit**

```bash
cd /c/Projects/stormleads/client && npx vite build
git add server/src/routes/properties.js client/src/components/LeadDetail.jsx
git commit -m "feat(reports): add comprehensive property report PDF with storm history, FEMA, and lead score"
```

---

## Task 4: Editable Work Order Milestones

**Goal:** Allow users to add, rename, delete, and reorder milestones on work orders.

**Files:**
- Modify: `client/src/components/WorkOrdersView.jsx`
- Modify: `server/src/routes/workOrders.js` (or wherever WO routes live)
- Modify: `server/src/services/workOrderService.js`

**Context:** Milestones currently render as checkboxes with photo upload (WorkOrdersView.jsx lines 269-352). Toggle works via PATCH. Need to add CRUD for milestone items.

- [ ] **Step 1: Add backend endpoints for milestone CRUD**

In the work orders route file, add:

```javascript
// POST /api/crm/work-orders/:id/milestones — Add a new milestone
router.post('/:id/milestones', async (req, res, next) => {
  try {
    const { name } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'Milestone name required' });
    const { rows: [wo] } = await pool.query(
      'SELECT id FROM work_orders WHERE id = $1 AND tenant_id = $2', [req.params.id, req.tenantId]
    );
    if (!wo) return res.status(404).json({ error: 'Work order not found' });

    const { rows: [maxOrder] } = await pool.query(
      'SELECT COALESCE(MAX(sort_order), 0) + 1 AS next_order FROM work_order_milestones WHERE work_order_id = $1',
      [req.params.id]
    );
    const { rows: [milestone] } = await pool.query(
      `INSERT INTO work_order_milestones (work_order_id, name, sort_order)
       VALUES ($1, $2, $3) RETURNING *`,
      [req.params.id, name.trim(), maxOrder.next_order]
    );
    res.status(201).json(milestone);
  } catch (err) { next(err); }
});

// DELETE /api/crm/work-orders/:woId/milestones/:milestoneId
router.delete('/:woId/milestones/:milestoneId', async (req, res, next) => {
  try {
    await pool.query(
      'DELETE FROM work_order_milestones WHERE id = $1 AND work_order_id = $2',
      [req.params.milestoneId, req.params.woId]
    );
    res.json({ success: true });
  } catch (err) { next(err); }
});

// PATCH /api/crm/work-orders/:woId/milestones/:milestoneId — Update name or sort_order
// (toggle completed already exists)
```

- [ ] **Step 2: Add API functions**

In `client/src/api/crm.js`, add:
```javascript
export const addWorkOrderMilestone = (woId, name) =>
  client.post(`/crm/work-orders/${woId}/milestones`, { name });

export const deleteWorkOrderMilestone = (woId, milestoneId) =>
  client.delete(`/crm/work-orders/${woId}/milestones/${milestoneId}`);
```

- [ ] **Step 3: Add inline milestone creation UI**

In `WorkOrdersView.jsx`, after the milestone list, add an "Add milestone" input:

```jsx
{/* Add milestone input */}
<div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
  <input
    className="form-input"
    placeholder="Add milestone..."
    value={newMilestoneName}
    onChange={e => setNewMilestoneName(e.target.value)}
    onKeyDown={e => { if (e.key === 'Enter' && newMilestoneName.trim()) handleAddMilestone(); }}
    style={{ flex: 1, fontSize: 12, padding: '6px 10px' }}
  />
  <button
    className="btn btn-primary"
    disabled={!newMilestoneName.trim()}
    onClick={handleAddMilestone}
    style={{ fontSize: 11, padding: '6px 12px' }}
  >
    Add
  </button>
</div>
```

Add state and handler:
```javascript
const [newMilestoneName, setNewMilestoneName] = useState('');

const handleAddMilestone = async () => {
  if (!newMilestoneName.trim() || !wo?.id) return;
  try {
    const { data } = await addWorkOrderMilestone(wo.id, newMilestoneName.trim());
    setMilestones(prev => [...prev, data]);
    setNewMilestoneName('');
  } catch {}
};
```

- [ ] **Step 4: Add delete button per milestone**

Next to each milestone checkbox, add a small X button (only on uncompleted milestones):
```jsx
{!m.completed && (
  <button
    onClick={async (e) => {
      e.stopPropagation();
      await deleteWorkOrderMilestone(wo.id, m.id);
      setMilestones(prev => prev.filter(ms => ms.id !== m.id));
    }}
    style={{
      background: 'none', border: 'none', color: 'var(--text-muted)',
      cursor: 'pointer', fontSize: 14, padding: '0 4px', opacity: 0.5,
    }}
    title="Remove milestone"
  >
    &times;
  </button>
)}
```

- [ ] **Step 5: Build check and commit**

```bash
cd /c/Projects/stormleads/client && npx vite build
git add client/src/components/WorkOrdersView.jsx client/src/api/crm.js server/src/routes/workOrders.js
git commit -m "feat(work-orders): add editable milestones — create, delete, inline input"
```

---

## Task 5: Invoice Payment Reminders

**Goal:** Automated overdue invoice email reminders via the existing automation/email infrastructure.

**Files:**
- Modify: `server/src/ingestion/scheduler.js`
- Modify: `server/src/services/emailService.js`
- Modify: `client/src/components/InvoicesView.jsx` (add reminder indicator)

**Context:** The scheduler runs cron jobs (drip sequences every 15min). Add an invoice overdue check that runs daily.

- [ ] **Step 1: Add overdue invoice check to scheduler**

In `server/src/ingestion/scheduler.js`, add a daily cron job:

```javascript
// Check for overdue invoices daily at 9am
cron.schedule('0 9 * * *', async () => {
  try {
    await sendOverdueInvoiceReminders();
  } catch (err) {
    logger.error({ err }, 'Overdue invoice reminders failed');
  }
});
```

- [ ] **Step 2: Implement the reminder function**

In `server/src/services/emailService.js`, add:

```javascript
export async function sendOverdueInvoiceReminders() {
  // Find invoices that are past due and haven't had a reminder in 7 days
  const { rows: overdueInvoices } = await pool.query(`
    SELECT i.*, t.name AS company_name, t.sender_email, t.branding,
           l.contact_name, l.contact_email
    FROM invoices i
    JOIN tenants t ON t.id = i.tenant_id
    LEFT JOIN leads l ON l.id = i.lead_id
    WHERE i.status = 'sent'
      AND i.due_date < NOW()
      AND (i.last_reminder_at IS NULL OR i.last_reminder_at < NOW() - INTERVAL '7 days')
      AND l.contact_email IS NOT NULL
  `);

  for (const inv of overdueInvoices) {
    try {
      const branding = inv.branding || {};
      const transporter = branding.smtp_host
        ? createTenantTransporter(branding)
        : getDefaultTransporter();
      if (!transporter) continue;

      const from = branding.smtp_from || inv.sender_email || '"StormLeads" <noreply@stormleads.io>';
      const daysOverdue = Math.floor((Date.now() - new Date(inv.due_date).getTime()) / (1000 * 60 * 60 * 24));

      await transporter.sendMail({
        from,
        to: inv.contact_email,
        subject: `Payment Reminder: Invoice ${inv.invoice_number} — ${daysOverdue} days overdue`,
        html: `<div style="font-family: -apple-system, sans-serif; max-width: 500px; margin: 0 auto; padding: 32px;">
          <h2 style="margin: 0 0 16px;">Payment Reminder</h2>
          <p>Hi ${inv.contact_name || 'there'},</p>
          <p>This is a friendly reminder that invoice <strong>${inv.invoice_number}</strong> for
          <strong>$${Number(inv.total || 0).toLocaleString()}</strong> was due on
          ${new Date(inv.due_date).toLocaleDateString()} (${daysOverdue} days ago).</p>
          <p>If you've already sent payment, please disregard this notice.</p>
          <p>Thank you,<br/>${inv.company_name || 'Your Contractor'}</p>
        </div>`,
      });

      // Mark reminder sent
      await pool.query(
        'UPDATE invoices SET last_reminder_at = NOW() WHERE id = $1',
        [inv.id]
      );
    } catch (err) {
      logger.warn({ err, invoiceId: inv.id }, 'Failed to send overdue reminder');
    }
  }
}
```

- [ ] **Step 3: Add last_reminder_at column if missing**

Check if `invoices` table has `last_reminder_at`. If not, create a migration:
```sql
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS last_reminder_at TIMESTAMPTZ;
```

- [ ] **Step 4: Add overdue badge to InvoicesView**

In `InvoicesView.jsx`, where invoice status badges render, add an overdue indicator:
```jsx
{inv.status === 'sent' && inv.due_date && new Date(inv.due_date) < new Date() && (
  <span style={{
    fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 6,
    background: 'oklch(0.30 0.12 30 / 0.4)', color: 'oklch(0.75 0.15 30)',
    marginLeft: 6,
  }}>
    OVERDUE
  </span>
)}
```

- [ ] **Step 5: Build check and commit**

```bash
cd /c/Projects/stormleads/client && npx vite build
git add server/src/ingestion/scheduler.js server/src/services/emailService.js client/src/components/InvoicesView.jsx
git commit -m "feat(invoices): automated overdue payment reminders with daily cron + overdue badge"
```

---

## Task 6: Estimate Approval Auto-Creates Work Order

**Goal:** When an estimate is approved (signed), automatically create a work order from it.

**Files:**
- Modify: `server/src/routes/estimates.js`
- Modify: `server/src/services/workOrderService.js`

**Context:** `createFromEstimate()` already exists in workOrderService.js (lines 137-156). Need to call it when estimate status changes to 'accepted'.

- [ ] **Step 1: Find the estimate acceptance endpoint**

Search for where estimate status is updated to 'accepted' — likely in the public estimate signing flow or an admin status update endpoint.

- [ ] **Step 2: Add auto-WO creation on acceptance**

After the estimate status is updated to 'accepted', add:
```javascript
// Auto-create work order when estimate is approved
if (newStatus === 'accepted') {
  try {
    await workOrderService.createFromEstimate(tenantId, estimateId);
  } catch (err) {
    logger.warn({ err, estimateId }, 'Auto work order creation failed');
    // Non-fatal — estimate still marked accepted
  }
}
```

- [ ] **Step 3: Add notification for auto-created WO**

After successful auto-creation, notify the assigned rep:
```javascript
const { createNotification } = await import('../services/notificationService.js');
await createNotification(tenantId, assignedRepId, {
  type: 'estimate_accepted',
  title: 'Work order auto-created',
  body: `Estimate ${estimateNumber} was approved — work order created automatically.`,
  reference_type: 'work_order',
  reference_id: newWorkOrder.id,
});
```

- [ ] **Step 4: Build check and commit**

```bash
cd /c/Projects/stormleads/client && npx vite build
git add server/src/routes/estimates.js
git commit -m "feat(estimates): auto-create work order when estimate is approved/signed"
```

---

## Task 7: Storm Archive/Catalog Page

**Goal:** A browsable, searchable list of all storms with preview cards.

**Files:**
- Create: `client/src/components/StormCatalog.jsx`
- Modify: `client/src/App.jsx` (add route)
- Modify: `client/src/components/Sidebar.jsx` (add nav item)

**Context:** `/api/storms` already returns a GeoJSON FeatureCollection with storm data. Dashboard already fetches storms with `getStorms()`. Just need a dedicated catalog page.

- [ ] **Step 1: Create StormCatalog component**

Create `client/src/components/StormCatalog.jsx`:

```jsx
import { useState, useEffect } from 'react';
import { getStorms } from '../api/storms';

const TIME_RANGES = [
  { id: '24h', label: '24 Hours' },
  { id: '3d', label: '3 Days' },
  { id: '7d', label: '7 Days' },
  { id: '14d', label: '14 Days' },
  { id: '30d', label: '30 Days' },
];

export default function StormCatalog() {
  const [storms, setStorms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState('30d');
  const [search, setSearch] = useState('');

  useEffect(() => {
    setLoading(true);
    getStorms({ timeRange, limit: 200 })
      .then(({ data }) => {
        const features = data?.features || [];
        setStorms(features.sort((a, b) =>
          new Date(b.properties?.event_start || 0) - new Date(a.properties?.event_start || 0)
        ));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [timeRange]);

  const filtered = storms.filter(s => {
    if (!search) return true;
    const p = s.properties || {};
    const text = `${p.raw_data?.type || ''} ${p.source || ''} ${p.hail_size_max_in || ''} ${p.wind_speed_max_mph || ''}`.toLowerCase();
    return text.includes(search.toLowerCase());
  });

  const typeLabel = (s) => {
    const rd = s.properties?.raw_data;
    if (rd?.type === 'hail' || s.properties?.hail_size_max_in) return 'Hail';
    if (rd?.type === 'wind' || s.properties?.wind_speed_max_mph) return 'Wind';
    if (rd?.type === 'tornado') return 'Tornado';
    if (rd?.type === 'severe_thunderstorm') return 'Severe T-Storm';
    return rd?.type || s.properties?.source || 'Storm';
  };

  const typeColor = (s) => {
    const label = typeLabel(s);
    if (label === 'Hail') return 'oklch(0.78 0.17 85)';
    if (label === 'Wind') return 'oklch(0.72 0.19 250)';
    if (label === 'Tornado') return 'oklch(0.70 0.20 30)';
    return 'oklch(0.75 0.10 200)';
  };

  return (
    <div style={{ padding: 'var(--space-xl)', maxWidth: 1000 }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 'var(--space-lg)' }}>Storm Archive</h1>

      <div style={{ display: 'flex', gap: 'var(--space-sm)', marginBottom: 'var(--space-lg)', flexWrap: 'wrap' }}>
        {TIME_RANGES.map(tr => (
          <button key={tr.id}
            className={`btn ${timeRange === tr.id ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setTimeRange(tr.id)}
            style={{ fontSize: 12, padding: '6px 14px' }}
          >
            {tr.label}
          </button>
        ))}
        <input
          className="form-input"
          placeholder="Search storms..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ flex: 1, minWidth: 180, fontSize: 13 }}
        />
      </div>

      {loading ? (
        <div style={{ color: 'var(--text-muted)', padding: 'var(--space-xl)' }}>Loading storms...</div>
      ) : filtered.length === 0 ? (
        <div style={{ color: 'var(--text-muted)', padding: 'var(--space-xl)', textAlign: 'center' }}>No storms found.</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 'var(--space-md)' }}>
          {filtered.map(s => {
            const p = s.properties || {};
            const date = p.event_start ? new Date(p.event_start).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';
            const time = p.event_start ? new Date(p.event_start).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : '';
            return (
              <div key={s.id} className="glass" style={{ borderRadius: 'var(--radius-lg)', padding: 'var(--space-lg)', cursor: 'pointer' }}
                onClick={() => window.location.href = `/storm-map?stormId=${s.id}`}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: typeColor(s) }}>{typeLabel(s)}</span>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{date} {time}</span>
                </div>
                <div style={{ display: 'flex', gap: 'var(--space-lg)', fontSize: 12 }}>
                  {p.hail_size_max_in && (
                    <div>
                      <div style={{ color: 'var(--text-muted)', fontSize: 10, marginBottom: 2 }}>Hail Size</div>
                      <div style={{ fontWeight: 700, color: 'oklch(0.78 0.17 85)' }}>{p.hail_size_max_in}"</div>
                    </div>
                  )}
                  {p.wind_speed_max_mph && (
                    <div>
                      <div style={{ color: 'var(--text-muted)', fontSize: 10, marginBottom: 2 }}>Wind Speed</div>
                      <div style={{ fontWeight: 700, color: 'oklch(0.72 0.19 250)' }}>{p.wind_speed_max_mph} mph</div>
                    </div>
                  )}
                  <div>
                    <div style={{ color: 'var(--text-muted)', fontSize: 10, marginBottom: 2 }}>Source</div>
                    <div style={{ fontWeight: 600 }}>{p.source?.replace('_', ' ') || '—'}</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Add route to App.jsx**

In `App.jsx`, add the lazy import and route:
```javascript
const StormCatalog = lazy(() => import('./components/StormCatalog'));
// In routes:
<Route path="/storm-catalog" element={<StormCatalog />} />
```

- [ ] **Step 3: Add to Sidebar navigation**

In `Sidebar.jsx`, add to the navigation items (under Storm Map or in a Weather group):
```javascript
{ id: 'storm-catalog', label: 'Storm Archive', Icon: ArchiveBoxIcon },
```
Import `ArchiveBoxIcon` from `@heroicons/react/24/outline`.

- [ ] **Step 4: Build check and commit**

```bash
cd /c/Projects/stormleads/client && npx vite build
git add client/src/components/StormCatalog.jsx client/src/App.jsx client/src/components/Sidebar.jsx
git commit -m "feat: add storm archive/catalog page with searchable storm cards"
```

---

## Task 8: Deal Value Display Improvements on Pipeline

**Goal:** Ensure pipeline cards prominently show deal value and column headers show revenue totals. Verify and enhance what already exists.

**Files:**
- Modify: `client/src/components/Pipeline.jsx`

**Context:** Pipeline already shows `estimated_value` on cards and column totals. But research shows it may not be prominent enough or the values may often be $0 because `estimated_value` isn't linked to actual estimates.

- [ ] **Step 1: Link estimate totals to lead estimated_value**

Check if when an estimate is created for a lead, the lead's `estimated_value` is updated. Search the estimates route/service for any code that updates the lead. If missing, add to the estimate creation flow:

In `server/src/services/estimateService.js`, after creating an estimate, update the lead:
```javascript
// After estimate is created/updated, sync total to lead's estimated_value
if (estimate.lead_id) {
  const { rows: [totals] } = await pool.query(
    `SELECT COALESCE(SUM(total), 0) AS sum FROM estimates
     WHERE lead_id = $1 AND tenant_id = $2 AND status != 'declined'`,
    [estimate.lead_id, tenantId]
  );
  await pool.query(
    'UPDATE leads SET estimated_value = $1 WHERE id = $2 AND tenant_id = $3',
    [totals.sum, estimate.lead_id, tenantId]
  );
}
```

- [ ] **Step 2: Make column revenue totals more prominent on desktop**

In `Pipeline.jsx`, find the desktop column header (around line 820-822). Make the revenue total larger and add a currency icon:
```jsx
{colTotal > 0 && (
  <div style={{
    fontSize: 14, fontWeight: 700, marginTop: 4,
    color: 'oklch(0.75 0.18 155)',
  }}>
    {formatCurrency(colTotal)}
  </div>
)}
```

- [ ] **Step 3: Build check and commit**

```bash
cd /c/Projects/stormleads/client && npx vite build
git add client/src/components/Pipeline.jsx server/src/services/estimateService.js
git commit -m "feat(pipeline): sync estimate totals to lead value, enhance column revenue display"
```

---

## Execution Order

Tasks are independent and can be run in parallel via subagent-driven-development, but the recommended serial order (by impact) is:

1. **Task 8** — Deal values on pipeline (fixes data flow)
2. **Task 1** — Dashboard drill-down (quick win, mostly wiring)
3. **Task 4** — Editable milestones (closes RoofLink gap)
4. **Task 5** — Invoice reminders (closes JobNimbus gap)
5. **Task 6** — Estimate→WO auto-creation (closes RoofLink gap)
6. **Task 2** — Estimate tiers (backend exists, just needs UI)
7. **Task 7** — Storm catalog (new page, independent)
8. **Task 3** — Property report PDF (nice-to-have, extends existing)
