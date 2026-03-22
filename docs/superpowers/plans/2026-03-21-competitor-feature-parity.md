# Competitor Feature Parity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement 9 features that close the gap between StormLeads and competitors JobNimbus + HailTrace, using only free/open-source solutions.

**Architecture:** Each feature is an independent vertical slice (migration → service → route → frontend component). All follow existing patterns: `pool.query()` backend, axios `client` frontend, oklch/glass UI, tenant-scoped data. External data fetched on-demand only — never bulk-preloaded to DB (Neon free tier constraint).

**Tech Stack:** PostgreSQL/PostGIS, Express, React, Vite, pdfmake (new — free/MIT for PDF generation), recharts (new — free/MIT for charts)

**CRITICAL CONSTRAINTS (read before every task):**
- ZERO paid APIs. Only free public data (NOAA, FEMA NSI).
- ZERO bulk geocoding (Google API costs real money).
- ZERO bulk DB writes. All data writes gated behind explicit user actions.
- Production DB is Neon free tier — minimize storage, prefer on-demand computation.
- Follow existing patterns: oklch colors, `.glass` class, dark-mode-first, pool.query(), axios client.
- Build check after every feature: `cd /c/Projects/stormleads/client && npx vite build`
- Commit after every completed feature.

---

## File Map

### New Files to Create
```
server/src/db/migrations/031_invoices.sql
server/src/db/migrations/032_canvass_pins.sql
server/src/db/migrations/033_custom_fields.sql
server/src/db/migrations/034_work_orders.sql
server/src/routes/weatherHistory.js
server/src/routes/automations.js
server/src/routes/invoices.js
server/src/routes/canvassing.js
server/src/routes/workOrders.js
server/src/routes/reports.js
server/src/services/weatherHistoryService.js
server/src/services/automationEngine.js
server/src/services/invoiceService.js
server/src/services/impactedAssetService.js
client/src/components/CalendarView.jsx
client/src/components/InvoicesView.jsx
client/src/components/CanvassingMode.jsx
client/src/components/ReportsView.jsx
client/src/components/WorkOrdersView.jsx
client/src/components/AutomationSettings.jsx
```

### Files to Modify
```
server/src/app.js                    — register new route modules
server/src/db/migrate.js             — new migrations auto-picked up
server/src/routes/crm.js             — custom fields on lead CRUD
server/src/services/crmService.js    — custom fields in queries
client/src/App.jsx                   — new routes
client/src/components/Sidebar.jsx    — new nav items
client/src/components/LeadDetail.jsx — weather history button, custom fields
client/src/components/SettingsView.jsx — automation rules tab
client/package.json                  — new deps (recharts, pdfmake, @fullcalendar)
```

---

## Task 1: Weather History Report (on-demand NOAA lookup + PDF)

**Files:**
- Create: `server/src/services/weatherHistoryService.js`
- Create: `server/src/routes/weatherHistory.js`
- Modify: `server/src/app.js` — register route
- Modify: `client/src/components/LeadDetail.jsx` — add button + modal

### Steps

- [ ] **Step 1: Create weather history service**

Query the NOAA Storm Events API (free, no key required) for historical hail/wind/tornado events near a given lat/lng. The NOAA Storm Events bulk CSV data is at `https://www.ncdc.noaa.gov/stormevents/`. However, the easier approach is to query our own `storm_events` table first (we already ingest NOAA data), then supplement with the NOAA Storm Events Web Service API at `https://www.ncei.noaa.gov/access/services/`.

```
server/src/services/weatherHistoryService.js
```

The service should:
1. Accept lat, lng, radius (default 5 miles)
2. Query local `storm_events` table for events whose geometry intersects a buffer around the point (PostGIS `ST_DWithin`)
3. Return array of events sorted by date descending with: date, type (hail/wind/tornado), hail_size, wind_speed, source
4. Do NOT store results — return in-memory only

- [ ] **Step 2: Create weather history route**

```
server/src/routes/weatherHistory.js
```

- `GET /api/properties/:id/weather-history` — authenticated
- Fetch property location from DB, call service, return JSON array
- No DB writes

Register in `server/src/app.js`:
```js
import weatherHistoryRoutes from './routes/weatherHistory.js';
app.use('/api/properties', weatherHistoryRoutes);
```

Note: This route file only handles the weather-history sub-path. Use `router.get('/:id/weather-history', ...)` and mount at `/api/properties`. Since properties.js already mounts at `/api/properties`, either add this route to the existing `properties.js` file OR mount with a more specific path first.

**Recommended:** Add the route directly to `server/src/routes/properties.js` after the existing `/:id/fema-lookup` route to keep property-related routes together.

- [ ] **Step 3: Add PDF generation endpoint**

Add `GET /api/properties/:id/weather-history/pdf` to the same route file.
- Install `pdfmake` on the server: `cd /c/Projects/stormleads && npm install pdfmake`
- Generate a PDF in-memory with: company name header, property address, table of storm events (date, type, severity), footer with generation date
- Return as `application/pdf` response with `Content-Disposition: attachment`
- Do NOT store the PDF in the DB

- [ ] **Step 4: Add "Storm History" button to LeadDetail.jsx**

In `client/src/components/LeadDetail.jsx`, add a button in the property info section:
- Button labeled "Storm History" with a cloud/lightning icon
- On click: fetch `/api/properties/${lead.property_id}/weather-history`
- Show results in a modal with a timeline/table
- Add "Download PDF" button that fetches the PDF endpoint and triggers browser download
- Style: glass panel, oklch colors, consistent with existing modals

- [ ] **Step 5: Build check and commit**

```bash
cd /c/Projects/stormleads/client && npx vite build
git add -A && git commit -m "feat: add on-demand weather history report with PDF generation"
```

---

## Task 2: Impacted Asset Alerts

**Files:**
- Create: `server/src/services/impactedAssetService.js`
- Modify: `server/src/ingestion/scheduler.js` or storm ingestion pipeline — hook after new swaths ingested
- Modify: `server/src/services/crmService.js` — optional: add "re-impacted" flag

### Steps

- [ ] **Step 1: Create impacted asset service**

```
server/src/services/impactedAssetService.js
```

Function `checkImpactedAssets(stormEventId)`:
1. Get the storm event geometry from `storm_events` table
2. Query `leads` joined with `properties` to find leads whose property location falls within the storm geometry: `ST_Contains(se.geom, p.location)` or `ST_Intersects`
3. For each impacted lead, create a notification in the `notifications` table:
   - type: 'storm_alert' (or add new enum value 'asset_impacted')
   - title: "Property re-impacted by storm"
   - body: "{address} was hit by {hail_size}" hail on {date}"
   - reference_type: 'lead', reference_id: lead.id
4. Only check leads with `deleted_at IS NULL` for all tenants that have leads in the affected area

- [ ] **Step 2: Hook into storm ingestion**

In the storm ingestion pipeline (likely `server/src/ingestion/scheduler.js` or wherever new storm_events are created), add a call to `checkImpactedAssets(newStormEventId)` after successful ingestion.

Find the exact insertion point by searching for where `INSERT INTO storm_events` happens and add the check after commit.

- [ ] **Step 3: Add notification enum value if needed**

Check if the `notification_type` enum includes 'storm_alert' or similar. If not, create a migration to add 'asset_impacted' value:
```sql
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'asset_impacted';
```

- [ ] **Step 4: Build check and commit**

```bash
cd /c/Projects/stormleads/client && npx vite build
git add -A && git commit -m "feat: add impacted asset alerts — notify when existing leads hit by new storms"
```

---

## Task 3: Calendar View

**Files:**
- Create: `client/src/components/CalendarView.jsx`
- Modify: `client/src/App.jsx` — add route
- Modify: `client/src/components/Sidebar.jsx` — add nav item
- Modify: `server/src/routes/crm.js` — add date-range query for tasks/activities

### Steps

- [ ] **Step 1: Install FullCalendar**

```bash
cd /c/Projects/stormleads/client && npm install @fullcalendar/react @fullcalendar/daygrid @fullcalendar/timegrid @fullcalendar/interaction @fullcalendar/list
```

FullCalendar is MIT licensed and free.

- [ ] **Step 2: Add date-range API endpoint**

Add to `server/src/routes/crm.js`:
- `GET /api/crm/calendar?start=ISO&end=ISO` — returns tasks and activities within date range
- Query tasks by `due_date` between start/end
- Query activities by `created_at` between start/end (for follow-ups, scheduled calls)
- Return combined array with `{ id, title, start, end, type, color, leadId }`

- [ ] **Step 3: Create CalendarView component**

```
client/src/components/CalendarView.jsx
```

- Use FullCalendar with dayGridMonth, timeGridWeek, timeGridDay, and list views
- Color-code by type: tasks (blue), calls (green), follow-ups (orange), inspections (purple)
- Click event → navigate to lead detail or open task edit
- Drag to reschedule → PATCH task due_date
- Style the calendar with oklch colors and glass panels using CSS overrides on FullCalendar classes
- Dark mode compatible

- [ ] **Step 4: Add route and nav**

In `client/src/App.jsx`:
- Add `calendar: '/calendar'` to viewRoutes
- Add `<Route path="/calendar" element={<CalendarView />} />`
- Lazy import: `const CalendarView = lazy(() => import('./components/CalendarView.jsx'))`

In `client/src/components/Sidebar.jsx`:
- Add `{ id: 'calendar', label: 'Calendar', Icon: CalendarDaysIcon }` to navItems array after 'tasks'
- Import `CalendarDaysIcon` from `@heroicons/react/24/outline`

- [ ] **Step 5: Build check and commit**

```bash
cd /c/Projects/stormleads/client && npx vite build
git add -A && git commit -m "feat: add calendar view with task/activity scheduling"
```

---

## Task 4: Workflow Automation Engine

**Files:**
- Create: `server/src/services/automationEngine.js`
- Create: `server/src/routes/automations.js`
- Create: `client/src/components/AutomationSettings.jsx`
- Modify: `server/src/app.js` — register route
- Modify: `server/src/routes/crm.js` — fire automation triggers on lead stage changes
- Modify: `client/src/components/SettingsView.jsx` — add Automations tab

### Steps

- [ ] **Step 1: Create automation engine service**

```
server/src/services/automationEngine.js
```

Export `fireTrigger(tenantId, triggerType, context)`:
1. Query active automations for this tenant matching triggerType
2. For each matching automation, evaluate trigger_config conditions against context
3. Execute action based on action_type:
   - `create_task`: INSERT into tasks table
   - `change_stage`: UPDATE lead stage
   - `send_email`: Queue email via existing nodemailer setup
   - `notify`: INSERT into notifications table
   - `assign_rep`: UPDATE lead assigned_rep_id
4. Log execution (just logger.info, no execution history table yet to save DB space)

Supported trigger types:
- `stage_changed` — context: { leadId, fromStage, toStage }
- `lead_created` — context: { leadId, source }
- `task_overdue` — context: { taskId, leadId } (checked via cron/interval)

- [ ] **Step 2: Create automation CRUD routes**

```
server/src/routes/automations.js
```

- `GET /api/crm/automations` — list tenant's automations
- `POST /api/crm/automations` — create automation rule
- `PATCH /api/crm/automations/:id` — update rule
- `DELETE /api/crm/automations/:id` — delete rule
- `PATCH /api/crm/automations/:id/toggle` — enable/disable

Register in `server/src/app.js`.

- [ ] **Step 3: Wire triggers into existing code**

In `server/src/services/crmService.js` (or `server/src/routes/crm.js`), after lead stage changes (PATCH /leads/:id), call:
```js
await fireTrigger(tenantId, 'stage_changed', { leadId, fromStage: old, toStage: new });
```

After lead creation (POST /crm/leads), call:
```js
await fireTrigger(tenantId, 'lead_created', { leadId, source });
```

- [ ] **Step 4: Create AutomationSettings component**

```
client/src/components/AutomationSettings.jsx
```

- List existing rules with enable/disable toggle
- "New Rule" button opens form:
  - Trigger type dropdown (Stage Changed, Lead Created, Task Overdue)
  - Trigger conditions (e.g., "when stage changes TO sold")
  - Action type dropdown (Create Task, Change Stage, Send Email, Notify, Assign Rep)
  - Action config fields (dynamic based on action type)
- Glass-styled cards for each rule

- [ ] **Step 5: Add Automations tab to SettingsView**

In `client/src/components/SettingsView.jsx`, add "Automations" tab that renders `<AutomationSettings />`.

- [ ] **Step 6: Build check and commit**

```bash
cd /c/Projects/stormleads/client && npx vite build
git add -A && git commit -m "feat: add workflow automation engine with trigger/action rules"
```

---

## Task 5: Invoicing

**Files:**
- Create: `server/src/db/migrations/031_invoices.sql`
- Create: `server/src/services/invoiceService.js`
- Create: `server/src/routes/invoices.js`
- Create: `client/src/components/InvoicesView.jsx`
- Modify: `server/src/app.js` — register route
- Modify: `client/src/App.jsx` — add route
- Modify: `client/src/components/Sidebar.jsx` — add nav item

### Steps

- [ ] **Step 1: Create invoices migration**

```sql
-- server/src/db/migrations/031_invoices.sql
CREATE TYPE invoice_status AS ENUM ('draft', 'sent', 'viewed', 'paid', 'overdue', 'void');

CREATE TABLE IF NOT EXISTS invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
  estimate_id UUID REFERENCES estimates(id) ON DELETE SET NULL,
  invoice_number VARCHAR(50) NOT NULL,
  status invoice_status DEFAULT 'draft',
  line_items JSONB NOT NULL DEFAULT '[]',
  subtotal NUMERIC(10,2) NOT NULL DEFAULT 0,
  tax_rate NUMERIC(5,4) DEFAULT 0,
  tax_amount NUMERIC(10,2) DEFAULT 0,
  total NUMERIC(10,2) NOT NULL DEFAULT 0,
  amount_paid NUMERIC(10,2) DEFAULT 0,
  due_date DATE,
  sent_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_invoices_tenant ON invoices(tenant_id);
CREATE INDEX idx_invoices_lead ON invoices(lead_id);
CREATE INDEX idx_invoices_status ON invoices(tenant_id, status);
```

- [ ] **Step 2: Create invoice service**

```
server/src/services/invoiceService.js
```

Functions:
- `getInvoices(tenantId, filters)` — list with pagination
- `getInvoice(tenantId, id)` — single invoice with lead details
- `createInvoice(tenantId, data)` — create with auto-generated invoice number (INV-001, INV-002...)
- `createFromEstimate(tenantId, estimateId)` — copy line_items from estimate, link both
- `updateInvoice(tenantId, id, data)` — update
- `recordPayment(tenantId, id, amount)` — add to amount_paid, set status to 'paid' if fully paid
- `markOverdue()` — batch update: set status='overdue' where due_date < now() and status='sent'

- [ ] **Step 3: Create invoice routes**

```
server/src/routes/invoices.js
```

- `GET /api/crm/invoices` — list
- `GET /api/crm/invoices/:id` — detail
- `POST /api/crm/invoices` — create
- `POST /api/crm/invoices/from-estimate/:estimateId` — create from estimate
- `PATCH /api/crm/invoices/:id` — update
- `POST /api/crm/invoices/:id/payment` — record payment
- `POST /api/crm/invoices/:id/send` — mark sent + email customer

- [ ] **Step 4: Create InvoicesView component**

```
client/src/components/InvoicesView.jsx
```

Reuse patterns from EstimatesView.jsx:
- List view with status filter tabs (All, Draft, Sent, Paid, Overdue)
- Status badges with colors: draft=gray, sent=blue, paid=green, overdue=red
- "New Invoice" and "Create from Estimate" buttons
- Invoice builder (reuse estimate line-item editor pattern)
- Payment recording modal
- Glass-styled cards, oklch colors

- [ ] **Step 5: Add route and nav**

Add to App.jsx routes and Sidebar.jsx navItems:
- `{ id: 'invoices', label: 'Invoices', Icon: BanknotesIcon }` after 'estimates'
- Route: `/invoices` → `<InvoicesView />`

- [ ] **Step 6: Build check and commit**

```bash
cd /c/Projects/stormleads/client && npx vite build
git add -A && git commit -m "feat: add invoicing with estimate conversion and payment tracking"
```

---

## Task 6: Canvassing Mode

**Files:**
- Create: `server/src/db/migrations/032_canvass_pins.sql`
- Create: `server/src/routes/canvassing.js`
- Create: `client/src/components/CanvassingMode.jsx`
- Modify: `server/src/app.js` — register route
- Modify: `client/src/App.jsx` — add route
- Modify: `client/src/components/Sidebar.jsx` — add nav item

### Steps

- [ ] **Step 1: Create canvass_pins migration**

```sql
-- server/src/db/migrations/032_canvass_pins.sql
CREATE TYPE canvass_outcome AS ENUM (
  'not_home', 'interested', 'not_interested', 'scheduled', 'follow_up', 'already_customer'
);

CREATE TABLE IF NOT EXISTS canvass_pins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
  location GEOMETRY(POINT, 4326),
  address VARCHAR(500),
  outcome canvass_outcome,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_canvass_pins_tenant ON canvass_pins(tenant_id);
CREATE INDEX idx_canvass_pins_user ON canvass_pins(user_id);
CREATE INDEX idx_canvass_pins_location ON canvass_pins USING GIST (location);
```

- [ ] **Step 2: Create canvassing routes**

```
server/src/routes/canvassing.js
```

- `GET /api/crm/canvass-pins?bbox=w,s,e,n&date=YYYY-MM-DD` — list pins in viewport
- `POST /api/crm/canvass-pins` — create pin (lat, lng, outcome, notes, address)
- `PATCH /api/crm/canvass-pins/:id` — update outcome/notes
- `POST /api/crm/canvass-pins/:id/convert` — convert pin to lead (create property + lead)
- `GET /api/crm/canvass-stats?date=YYYY-MM-DD` — daily stats (doors knocked, outcomes breakdown)

- [ ] **Step 3: Create CanvassingMode component**

```
client/src/components/CanvassingMode.jsx
```

- Full-screen Google Map (reuse existing map setup from StormMap)
- Mobile-optimized: large tap targets, bottom sheet for pin details
- "Drop Pin" button uses browser geolocation to get current GPS position
- Quick-select outcome buttons (Not Home, Interested, Not Interested, Scheduled)
- Optional notes field
- Color-coded pins on map by outcome
- Daily stats bar at top (X doors, Y interested, Z scheduled)
- "Convert to Lead" button on interested pins
- Address auto-filled from reverse geocode (single property, user-initiated via the pin drop)

**GPS verification:** Validate that dropped pin is within 50 feet of the browser's GPS coordinates. Reject if user tries to drop a pin from far away.

**Note on geocoding:** The pin uses the browser's GPS coordinates directly (no Google geocoding needed). Address can optionally be reverse-geocoded ONLY for the single pin being dropped (one call per user action, not bulk).

- [ ] **Step 4: Add route and nav**

Add to App.jsx and Sidebar.jsx:
- `{ id: 'canvassing', label: 'Canvassing', Icon: MapPinIcon }` after 'calendar'
- Route: `/canvassing` → `<CanvassingMode />`

- [ ] **Step 5: Build check and commit**

```bash
cd /c/Projects/stormleads/client && npx vite build
git add -A && git commit -m "feat: add canvassing mode with GPS-verified pin dropping"
```

---

## Task 7: Custom Fields on Leads

**Files:**
- Create: `server/src/db/migrations/033_custom_fields.sql`
- Modify: `server/src/routes/crm.js` — custom field definition CRUD
- Modify: `server/src/services/crmService.js` — include custom_fields in lead queries
- Modify: `client/src/components/LeadDetail.jsx` — render dynamic fields
- Modify: `client/src/components/SettingsView.jsx` — field definition UI

### Steps

- [ ] **Step 1: Create custom fields migration**

```sql
-- server/src/db/migrations/033_custom_fields.sql

-- Tenant-level field definitions
CREATE TABLE IF NOT EXISTS custom_field_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  entity_type VARCHAR(20) NOT NULL DEFAULT 'lead', -- 'lead', 'contact', etc.
  field_key VARCHAR(50) NOT NULL,
  field_label VARCHAR(100) NOT NULL,
  field_type VARCHAR(20) NOT NULL DEFAULT 'text', -- text, number, date, select, boolean
  options JSONB, -- for select type: ["Option A", "Option B"]
  sort_order INTEGER DEFAULT 0,
  is_required BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tenant_id, entity_type, field_key)
);

-- Add JSONB column to leads for storing custom field values
ALTER TABLE leads ADD COLUMN IF NOT EXISTS custom_fields JSONB DEFAULT '{}';
```

- [ ] **Step 2: Add custom field definition CRUD to crm routes**

In `server/src/routes/crm.js`:
- `GET /api/crm/custom-fields?entity_type=lead` — list tenant's field definitions
- `POST /api/crm/custom-fields` — create field definition
- `PATCH /api/crm/custom-fields/:id` — update
- `DELETE /api/crm/custom-fields/:id` — delete definition

- [ ] **Step 3: Include custom_fields in lead queries**

In `server/src/services/crmService.js`:
- Add `custom_fields` to SELECT in `getLeads()` and `getLeadDetail()`
- In `updateLead()`, allow updating `custom_fields` JSONB
- Validate custom_fields values against field definitions on write

- [ ] **Step 4: Add custom fields to LeadDetail.jsx**

In `client/src/components/LeadDetail.jsx`:
- Fetch field definitions on mount: `GET /api/crm/custom-fields?entity_type=lead`
- Render dynamic form fields based on definitions (text input, number input, date picker, select dropdown, checkbox)
- Save via existing lead PATCH with `custom_fields` in body
- Show in a "Custom Fields" section below the existing fields

- [ ] **Step 5: Add field management to SettingsView**

In `client/src/components/SettingsView.jsx`, add a "Custom Fields" tab:
- List existing field definitions with drag-to-reorder
- "Add Field" form: label, key (auto-generated from label), type, options (for select), required
- Delete field with confirmation

- [ ] **Step 6: Build check and commit**

```bash
cd /c/Projects/stormleads/client && npx vite build
git add -A && git commit -m "feat: add custom fields on leads with tenant-scoped definitions"
```

---

## Task 8: Report Builder

**Files:**
- Create: `server/src/routes/reports.js`
- Create: `client/src/components/ReportsView.jsx`
- Modify: `server/src/app.js` — register route
- Modify: `client/src/App.jsx` — add route
- Modify: `client/src/components/Sidebar.jsx` — add nav item

### Steps

- [ ] **Step 1: Install recharts**

```bash
cd /c/Projects/stormleads/client && npm install recharts
```

Recharts is MIT licensed, free, React-native charting library.

- [ ] **Step 2: Create report endpoints**

```
server/src/routes/reports.js
```

All endpoints accept `?start=ISO&end=ISO` date range filters. All tenant-scoped.

- `GET /api/crm/reports/revenue` — estimated_value + actual_value by month (from leads)
- `GET /api/crm/reports/pipeline` — leads count by stage
- `GET /api/crm/reports/conversion` — conversion rates: leads created vs sold, by source
- `GET /api/crm/reports/rep-performance` — per-rep: leads assigned, sold, total value, activities count
- `GET /api/crm/reports/stage-duration` — average days in each stage
- `GET /api/crm/reports/lead-sources` — leads and revenue grouped by source

All queries are live SQL aggregations — no materialized views, no stored report data.

- [ ] **Step 3: Create ReportsView component**

```
client/src/components/ReportsView.jsx
```

- Date range picker at top (preset: This Week, This Month, This Quarter, This Year, Custom)
- Report cards in a grid layout:
  1. **Revenue** — bar chart (recharts BarChart) by month
  2. **Pipeline** — horizontal bar chart showing leads per stage
  3. **Conversion Funnel** — funnel visualization (reuse existing Dashboard pattern)
  4. **Rep Leaderboard** — table with rep name, leads, closed, value, activities
  5. **Lead Sources** — pie chart showing source distribution
  6. **Stage Duration** — bar chart showing avg days per stage
- Glass-styled cards, oklch colors
- Each card is a self-contained component that fetches its own data

- [ ] **Step 4: Add route and nav**

Add to App.jsx and Sidebar.jsx:
- `{ id: 'reports', label: 'Reports', Icon: ChartBarIcon }` after 'invoices'
- Route: `/reports` → `<ReportsView />`

- [ ] **Step 5: Build check and commit**

```bash
cd /c/Projects/stormleads/client && npx vite build
git add -A && git commit -m "feat: add report builder with revenue, pipeline, conversion, and rep performance charts"
```

---

## Task 9: Work Orders

**Files:**
- Create: `server/src/db/migrations/034_work_orders.sql`
- Create: `server/src/services/workOrderService.js`
- Create: `server/src/routes/workOrders.js`
- Create: `client/src/components/WorkOrdersView.jsx`
- Modify: `server/src/app.js` — register route
- Modify: `client/src/App.jsx` — add route
- Modify: `client/src/components/Sidebar.jsx` — add nav item

### Steps

- [ ] **Step 1: Create work_orders migration**

```sql
-- server/src/db/migrations/034_work_orders.sql
CREATE TYPE work_order_status AS ENUM (
  'pending', 'scheduled', 'in_progress', 'completed', 'cancelled'
);

CREATE TABLE IF NOT EXISTS work_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
  estimate_id UUID REFERENCES estimates(id) ON DELETE SET NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  status work_order_status DEFAULT 'pending',
  assigned_to UUID REFERENCES users(id) ON DELETE SET NULL,
  crew_name VARCHAR(100),
  scheduled_date DATE,
  scheduled_time_start TIME,
  scheduled_time_end TIME,
  completed_at TIMESTAMPTZ,
  line_items JSONB DEFAULT '[]',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_work_orders_tenant ON work_orders(tenant_id);
CREATE INDEX idx_work_orders_lead ON work_orders(lead_id);
CREATE INDEX idx_work_orders_status ON work_orders(tenant_id, status);
CREATE INDEX idx_work_orders_scheduled ON work_orders(scheduled_date) WHERE status != 'completed';
```

- [ ] **Step 2: Create work order service**

```
server/src/services/workOrderService.js
```

Functions:
- `getWorkOrders(tenantId, filters)` — list with status/assignee/date filters
- `getWorkOrder(tenantId, id)` — detail with lead info
- `createWorkOrder(tenantId, data)` — create
- `createFromEstimate(tenantId, estimateId)` — copy line_items, link to lead
- `updateWorkOrder(tenantId, id, data)` — update status, assignment, schedule
- `completeWorkOrder(tenantId, id)` — set completed_at, status='completed'

- [ ] **Step 3: Create work order routes**

```
server/src/routes/workOrders.js
```

- `GET /api/crm/work-orders` — list
- `GET /api/crm/work-orders/:id` — detail
- `POST /api/crm/work-orders` — create
- `POST /api/crm/work-orders/from-estimate/:estimateId` — create from estimate
- `PATCH /api/crm/work-orders/:id` — update
- `PATCH /api/crm/work-orders/:id/complete` — mark complete

- [ ] **Step 4: Create WorkOrdersView component**

```
client/src/components/WorkOrdersView.jsx
```

- Kanban board view (reuse drag pattern from Pipeline.jsx):
  - Columns: Pending, Scheduled, In Progress, Completed
  - Cards showing: title, crew/assignee, scheduled date, lead address
  - Drag between columns to change status
- "New Work Order" and "Create from Estimate" buttons
- Work order detail modal with: assignment, scheduling (date + time), notes, line items
- Glass-styled, oklch colors

- [ ] **Step 5: Add route and nav**

Add to App.jsx and Sidebar.jsx:
- `{ id: 'work-orders', label: 'Work Orders', Icon: WrenchScrewdriverIcon }` after 'materials'
- Route: `/work-orders` → `<WorkOrdersView />`

- [ ] **Step 6: Build check and commit**

```bash
cd /c/Projects/stormleads/client && npx vite build
git add -A && git commit -m "feat: add work orders with kanban board and estimate conversion"
```

---

## Final Steps

- [ ] **Run full build check**
```bash
cd /c/Projects/stormleads/client && npx vite build
```

- [ ] **Run migrations**
```bash
cd /c/Projects/stormleads && node server/src/db/migrate.js
```

- [ ] **Final commit**
```bash
git add -A && git commit -m "feat: complete competitor feature parity — 9 new features"
```
