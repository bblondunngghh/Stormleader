# Navigation Consolidation + New Features

## Overview

Consolidate the sidebar from 14 flat items into grouped navigation, and add 4 new features: Contracts, Expense Tracking, Client Progress Page, and Work Order Milestones.

---

## 1. Sidebar Restructure

### Top-level (always visible)
- Dashboard
- Storm Map
- Pipeline
- Leads

### Collapsible groups (collapsed by default)
- **Jobs** → Estimates, Contracts, Work Orders, Materials
- **Finance** → Invoices, Expenses
- **Operations** → Tasks, Calendar, Canvassing, Reports

### Bottom (always visible)
- Settings
- Admin (super_admin only)

### Behavior
- Click group header to expand/collapse. Chevron icon rotates on expand.
- Collapsed state persisted in `localStorage` so it remembers across sessions.
- When a child route is active, its parent group auto-expands.
- Group headers are not navigable — they only toggle expand/collapse.
- Children are indented with the same L-bracket visual pattern used in the storm map layer panel.
- Materials, Canvassing, Reports, and other existing flat nav items move into their respective groups (removed from the flat list).

---

## 2. Contracts

### Flow
Estimate → customer accepts (or manual trigger) → generate contract → customer signs.

### Contract Generation
- Auto-populate from estimate: customer info (name, email, phone, address), scope of work (line items), total, financing terms if applicable.
- All fields editable before sending.
- Contract stored as JSONB content for flexibility.

### Built-in Templates
1. **Standard Roofing** — scope, payment terms, warranty, start date, completion estimate
2. **Insurance Restoration** — insurance company, claim number, ACV/RCV fields, supplement language, assignment of benefits
3. **Financing** — lender name, payment plan terms, interest rate, monthly payment, financing disclosure
4. **Supplement Agreement** — reference to original contract, additional scope, revised total

### Template Structure
Each template defines sections (array of `{ title, body }` blocks). Body supports merge fields: `{{customer_name}}`, `{{address}}`, `{{scope_of_work}}`, `{{total}}`, `{{date}}`, etc. Merge fields resolve from the linked estimate and lead data.

Built-in templates are seeded via migration with `tenant_id = NULL, is_default = TRUE`. The list endpoint returns templates where `tenant_id IS NULL OR tenant_id = $tenantId`.

### Customer-Facing Page
- Public URL: `/contract/:token`
- Displays contract content, company branding, scope details
- E-signature canvas (reuse existing `SignatureCanvas` from `PublicEstimate.jsx`)
- After signing: signature + timestamp stored, status → `signed`

### Statuses
`draft` → `sent` → `viewed` → `signed` → `voided`

### Access Points
- Contracts page (under Jobs group) — list all contracts with status filter
- Lead detail page — contracts tab showing contracts for that lead, "Generate Contract" button
- Estimate detail — "Create Contract" action after estimate is accepted

### Custom Templates
- Created from Settings > Contracts tab
- Clone a built-in template or start from scratch
- Define sections, merge fields, default terms

### API

**Public routes (declared before authenticate/tenantScope middleware in router):**
- `GET /api/crm/contracts/public/:token` — public view (no auth)
- `POST /api/crm/contracts/public/:token/sign` — submit signature (no auth)

**Authenticated routes:**
- `GET /api/crm/contracts` — list (with status/lead filters)
- `GET /api/crm/contracts/:id` — single contract
- `POST /api/crm/contracts` — create (from estimate or standalone)
- `PATCH /api/crm/contracts/:id` — update draft
- `POST /api/crm/contracts/:id/send` — mark as sent, generate token
- `POST /api/crm/contracts/:id/void` — void a contract
- `GET /api/crm/contract-templates` — list templates
- `POST /api/crm/contract-templates` — create custom template
- `PATCH /api/crm/contract-templates/:id` — update template
- `DELETE /api/crm/contract-templates/:id` — delete custom template

Note: Public routes must be registered before `router.use(authenticate)` call, mirroring the pattern in `estimates.js`.

---

## 3. Expense Tracking

### Purpose
Simple job costing: track expenses per lead/job, show profit/loss.

### Expense Fields
- `lead_id` — which job (optional, can be unassigned)
- `category` — enum: materials, labor, subcontractor, permit, dumpster, other
- `amount` — decimal
- `date` — date of expense
- `notes` — free text
- `created_by` — user who logged it

### API
- `GET /api/crm/expenses` — list (with category/lead/date filters)
- `POST /api/crm/expenses` — create
- `PATCH /api/crm/expenses/:id` — update
- `DELETE /api/crm/expenses/:id` — delete

---

### 3.1 Expenses Page Layout (under Finance group)

#### Page Structure
```
┌─────────────────────────────────────────────────────┐
│  Page Header                                        │
│  ┌─────────────────────────────┐  ┌──────────────┐  │
│  │ "Expenses" h2               │  │ + Add Expense│  │
│  │ subtitle: total count       │  │  .auth-btn   │  │
│  └─────────────────────────────┘  └──────────────┘  │
│                                                     │
│  Filter Bar (.glass)                                │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────┐ │
│  │ Category │ │ Date From│ │ Date To  │ │Lead/Job│ │
│  │ <select> │ │ <input>  │ │ <input>  │ │<select>│ │
│  └──────────┘ └──────────┘ └──────────┘ └────────┘ │
│                                                     │
│  Summary Cards Row                                  │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐            │
│  │Total Exp.│ │ # Entries│ │ Avg/Entry│            │
│  │ $12,450  │ │   34     │ │  $366    │            │
│  └──────────┘ └──────────┘ └──────────┘            │
│                                                     │
│  Expense Table (.glass, .lead-table)                │
│  ┌─────────────────────────────────────────────┐    │
│  │ Date | Category | Lead/Job | Amount | Notes │    │
│  │ ...rows...                                  │    │
│  └─────────────────────────────────────────────┘    │
│                                                     │
│  Pagination                                         │
└─────────────────────────────────────────────────────┘
```

#### Page Header
- Layout: `display: flex; justify-content: space-between; align-items: center`
- Title: `<h2>` using `font-size: 22px; font-weight: 800; color: var(--text-primary)`
- Subtitle (record count): `font-size: 13px; color: var(--text-muted); margin-top: var(--space-xs)`
- "Add Expense" button: `.auth-btn` (height 36px, border-radius 14px/12px, background var(--accent-blue), font-weight 700, font-size 13px)
- Gap between header and filter bar: `var(--space-xl)` (24px)

#### Filter Bar
- Container: `.glass` panel, `border-radius: 20px / 18px`, `padding: var(--space-lg)` (16px)
- Layout: `display: flex; gap: var(--space-md); align-items: center; flex-wrap: wrap`
- Each filter: `.form-group` wrapper with `.form-input` field
- All selects/inputs: height `36px`, `border-radius: 12px`, `font-size: 13px`, background `oklch(0.22 0.02 260 / 0.45)`
- Labels: `font-size: 12px; font-weight: 600; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.08em`
- Category select: `<select className="form-input">` with options: All, Materials, Labor, Subcontractor, Permit, Dumpster, Other
- Date inputs: `<input type="date" className="form-input">` with `color-scheme: dark`
- Lead/Job select: `<select className="form-input">` populated from leads API, shows "All Jobs" as default
- Gap between filter bar and summary cards: `var(--space-xl)` (24px)

#### Summary Cards Row
- Layout: `display: grid; grid-template-columns: repeat(3, 1fr); gap: var(--space-lg)` (16px)
- Each card: `.stat-card` with `.glass` — `border-radius: var(--radius-xl)` (16px), `padding: var(--space-xl)` (24px)
- **Do NOT override glass background, border, or box-shadow on stat cards** — use inherited `.glass` + `.stat-card` styles only
- Value: `.stat-card__value` — `font-size: 30px; font-weight: 800; letter-spacing: -0.03em; color: var(--text-primary)`
- Label: `.stat-card__label` — `font-size: 11px; font-weight: 500; color: var(--text-muted)`
- Cards:
  1. "Total Expenses" — sum of `amount` for current filter, formatted as currency
  2. "Entries" — count of rows matching current filter
  3. "Avg per Entry" — total / count, formatted as currency
- Gap between summary cards and table: `var(--space-xl)` (24px)

#### Expense Table
- Wrapper: `.glass` container, `border-radius: 20px / 18px`, `overflow: hidden`
- Table: `.lead-table` — `width: 100%; border-collapse: collapse; font-size: 13px`
- Header cells (`.lead-table th`): `padding: var(--space-md) var(--space-lg)` (8px 16px), `font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: var(--text-muted); background: oklch(0.16 0.02 260 / 0.9); border-bottom: 1px solid var(--glass-border); position: sticky; top: 0; z-index: 2; white-space: nowrap`
- Body cells (`.lead-table td`): `padding: var(--space-md) var(--space-lg)` (8px 16px), `border-bottom: 1px solid oklch(0.25 0.02 260 / 0.2); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 220px`
- Row hover: `background: oklch(0.22 0.03 260 / 0.4); transition: background 0.15s var(--ease-out)`
- Columns:
  1. **Date** — formatted as `MMM DD, YYYY`, `color: var(--text-secondary)`
  2. **Category** — pill badge styled like `.lead-table__stage`: `font-size: 10px; font-weight: 700; padding: 3px 10px; border-radius: var(--radius-pill); backdrop-filter: blur(8px); border: 1px solid oklch(0.40 0.02 260 / 0.15)`. Category-specific colors:
     - materials: `background: oklch(0.50 0.15 250 / 0.15); color: oklch(0.72 0.19 250)` (blue)
     - labor: `background: oklch(0.50 0.17 145 / 0.15); color: oklch(0.75 0.18 155)` (green)
     - subcontractor: `background: oklch(0.50 0.16 310 / 0.15); color: oklch(0.70 0.18 310)` (purple)
     - permit: `background: oklch(0.50 0.15 80 / 0.15); color: oklch(0.78 0.17 85)` (amber)
     - dumpster: `background: oklch(0.50 0.14 55 / 0.15); color: oklch(0.75 0.16 55)` (orange)
     - other: `background: oklch(0.28 0.03 260 / 0.5); color: var(--text-secondary)` (neutral)
  3. **Lead/Job** — linked lead name (clickable, `color: var(--accent-blue); cursor: pointer`), or "Unassigned" in `color: var(--text-muted); font-style: italic`
  4. **Amount** — right-aligned, `font-weight: 700; font-variant-numeric: tabular-nums; color: var(--text-primary)`, formatted as `$1,234.56`
  5. **Notes** — truncated with `text-overflow: ellipsis; max-width: 220px`, `color: var(--text-secondary)`
  6. **Actions** — icon buttons (edit pencil, delete trash) appearing on row hover only: `opacity: 0` default, `opacity: 1` on `.lead-table tbody tr:hover`; each icon button: `width: 28px; height: 28px; border-radius: var(--radius-sm); display: flex; align-items: center; justify-content: center; color: var(--text-muted); hover: background oklch(0.30 0.03 260 / 0.4), color var(--text-primary)`
- Empty state: centered message "No expenses found" with muted text and a CTA button to add the first expense
- Default sort: date descending (newest first)

#### Pagination
- Reuse existing pagination pattern from LeadList: `.quick-action-btn` styled prev/next buttons
- Page size selector: `<select className="form-input">` with options 25, 50, 100
- Layout: `display: flex; justify-content: space-between; align-items: center; padding: var(--space-lg) 0`
- "Showing X–Y of Z" label: `font-size: 13px; color: var(--text-muted)`

---

### 3.2 Add/Edit Expense Slide-Over

#### Trigger
- "Add Expense" button on Expenses page header
- Edit icon on table row
- "Add Expense" quick action from Lead Detail expenses tab

#### Slide-Over Structure
```
┌──────────────────────────────┐
│  ╳ close                     │
│                              │
│  Add Expense / Edit Expense  │
│  ─────────── divider ──────  │
│                              │
│  Category     [select    ▾]  │
│  Amount       [$  0.00    ]  │
│  Date         [2026-03-24 ]  │
│  Lead/Job     [select    ▾]  │
│  Notes        [textarea   ]  │
│               [           ]  │
│                              │
│  ─────────── divider ──────  │
│  [Cancel]          [Save]    │
└──────────────────────────────┘
```

#### Container
- Backdrop: `.slide-over-backdrop` — `position: fixed; top: 64px; inset: 0; background: oklch(0.05 0.02 260 / 0.6); backdrop-filter: blur(4px); z-index: 100; animation: fadeIn 0.25s var(--ease-out)`
- Panel: `.slide-over` with `.glass` — `position: fixed; top: calc(64px + var(--space-md)); right: var(--space-md); bottom: var(--space-md); width: 480px; max-width: 90vw; border-radius: 20px / 18px; padding: var(--space-2xl); z-index: 101; animation: slideIn 0.35s var(--ease-out); display: flex; flex-direction: column; gap: var(--space-xl)`

#### Close Button
- `.slide-over__close` — `position: absolute; top: var(--space-xl); right: var(--space-xl); width: 32px; height: 32px; border-radius: var(--radius-sm); display: flex; align-items: center; justify-content: center; color: var(--text-muted); hover: background oklch(0.30 0.03 260 / 0.4), color var(--text-primary)`
- Also close on backdrop click and Escape key

#### Header
- `.slide-over__header` — `padding-right: 40px` (clear the close button)
- Title: `font-size: 18px; font-weight: 700; color: var(--text-primary)`
- "Add Expense" for create, "Edit Expense" for edit

#### Dividers
- `.divider` — `height: 1px; background: var(--glass-border)`
- One after header, one before footer actions

#### Form Fields
- Layout: `display: flex; flex-direction: column; gap: var(--space-lg)` (16px between groups)
- Each field: `.form-group` wrapper (`display: flex; flex-direction: column; gap: var(--space-xs)`)
- Labels: `font-size: 12px; font-weight: 600; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.08em`
- Fields:
  1. **Category** — `<select className="form-input">`, height 36px, border-radius 12px, required. Options: Materials, Labor, Subcontractor, Permit, Dumpster, Other
  2. **Amount** — `<input type="number" className="form-input" step="0.01" min="0">`, height 36px, border-radius 12px, required. Prepend "$" via CSS `::before` or inline span
  3. **Date** — `<input type="date" className="form-input">`, height 36px, border-radius 12px, `color-scheme: dark`, required. Default to today
  4. **Lead/Job** — `<select className="form-input">`, height 36px, border-radius 12px, optional. First option: "None (Unassigned)", then leads sorted by name
  5. **Notes** — `<textarea className="form-input" rows="3">`, auto-height, `padding: var(--space-md) var(--space-lg)`, border-radius 12px, optional
- Focus state on all fields: `border-color: oklch(0.55 0.12 250 / 0.4); background: oklch(0.26 0.02 260 / 0.55)`
- Validation errors: `font-size: 12px; color: var(--accent-red); margin-top: var(--space-xs)`

#### Footer Actions
- Layout: `display: flex; justify-content: flex-end; gap: var(--space-md); margin-top: auto`
- Cancel: `.quick-action-btn` — `padding: var(--space-sm) var(--space-lg); border-radius: 14px/12px; font-size: 13px; font-weight: 600; color: var(--text-secondary)`
- Save: `.auth-btn` — `height: 36px; padding: 0 var(--space-xl); border-radius: 14px/12px; background: var(--accent-blue); font-size: 13px; font-weight: 700; color: oklch(0.15 0.02 260)`
- Save disabled state: `opacity: 0.5; cursor: not-allowed` when form is invalid or submitting
- Loading state: replace button text with spinner (use existing pattern), keep button width stable with `min-width`

---

### 3.3 Delete Confirmation

- Triggered by trash icon on row hover
- Use a minimal confirmation inline or a small modal, NOT a browser `confirm()` dialog
- Confirmation pattern: replace the row actions area with "Delete?" text + "Yes" (red) / "No" buttons, both `font-size: 12px`
- "Yes" button: `color: var(--accent-red); font-weight: 700`
- "No" button: `color: var(--text-muted)`
- Revert to normal actions on "No" click or after 5 seconds timeout
- On delete success: row animates out with `opacity: 0; transform: translateX(20px); transition: all 0.25s var(--ease-out)`, then removed from DOM

---

### 3.4 Lead Detail Integration

#### Expenses Tab
- Added as a new tab on lead detail page alongside existing tabs (Info, Documents, Activity, etc.)
- Tab styling: reuse existing tab pattern from LeadDetail — `.task-filter-tab` style tabs
- Tab label: "Expenses" with badge count: `font-size: 10px; background: oklch(0.28 0.04 260 / 0.6); border-radius: var(--radius-pill); padding: 1px 8px; margin-left: var(--space-sm)`

#### Profit Summary Card
- Positioned at top of the expenses tab content, before the expense list
- Container: `.glass` with `border-radius: var(--radius-xl)` (16px), `padding: var(--space-xl)`
- Layout: `display: grid; grid-template-columns: repeat(3, 1fr); gap: var(--space-lg); text-align: center`
- Three values:
  1. **Estimate Total** — `.stat-card__value` styling, `color: var(--text-primary)`
  2. **Total Expenses** — `.stat-card__value` styling, `color: var(--accent-red)`
  3. **Profit** — `.stat-card__value` styling, color conditional: `var(--accent-green)` if positive, `var(--accent-red)` if negative
- Each value has a `.stat-card__label` beneath it
- Profit percentage shown in parentheses: `font-size: 14px; font-weight: 600`
- If no estimate exists: show "No estimate" for Estimate Total in `color: var(--text-muted); font-style: italic`

#### Inline Expense List
- Reuse `.lead-table` but with fewer columns: Date, Category, Amount, Notes, Actions
- "Add Expense" button: `.quick-action-btn` with `+ Add Expense` label, positioned top-right of tab content
- Pre-fills `lead_id` automatically when opening slide-over from here

---

### 3.5 UI Consistency Checklist

Every implementation MUST pass these checks before the feature is considered complete:

#### Buttons
- [ ] Primary actions use `.auth-btn` (height 36px, border-radius 14px/12px, accent-blue bg, 700 weight)
- [ ] Secondary actions use `.quick-action-btn` (8px/16px padding, border-radius 14px/12px, glass bg)
- [ ] All buttons have hover state: `filter: brightness(1.1)` + `translateY(-1px)` for primary; `background` shift for secondary
- [ ] Disabled buttons show `opacity: 0.5; cursor: not-allowed`
- [ ] Button text is `font-size: 13px` consistently
- [ ] No raw `<button>` elements without a class — every button has either `.auth-btn` or `.quick-action-btn`

#### Forms
- [ ] All inputs use `.form-input` (height 36px, border-radius 12px, oklch glass bg)
- [ ] All labels use `.form-group label` pattern (12px, 600 weight, uppercase, 0.08em tracking)
- [ ] Form groups use `.form-group` with `gap: var(--space-xs)` between label and input
- [ ] Selects have `appearance: none` with custom dropdown indicator
- [ ] Date inputs have `color-scheme: dark`
- [ ] Focus states use `border-color: oklch(0.55 0.12 250 / 0.4)` + brightened background
- [ ] Placeholder text uses `color: var(--text-muted)`

#### Modals / Slide-Overs
- [ ] Uses `.slide-over-backdrop` (top: 64px to clear topbar, blur(4px), fadeIn animation)
- [ ] Panel uses `.slide-over` + `.glass` (width 480px, border-radius 20px/18px, slideIn animation)
- [ ] Close button is `.slide-over__close` (32px, top-right, radius-sm)
- [ ] Closes on backdrop click AND Escape key
- [ ] Header has `padding-right: 40px` to avoid close button overlap
- [ ] `.divider` separates header from body and body from footer
- [ ] Footer actions are right-aligned with `justify-content: flex-end`

#### Tables
- [ ] Uses `.lead-table` class on `<table>` element
- [ ] Header row: sticky, uppercase, 11px, 700 weight, oklch background
- [ ] Cell padding: `var(--space-md) var(--space-lg)` (8px 16px)
- [ ] Row hover: `oklch(0.22 0.03 260 / 0.4)` background transition
- [ ] Text overflow: `ellipsis` with `max-width: 220px` on content cells
- [ ] Empty state: centered muted text with CTA

#### Spacing
- [ ] Page sections separated by `var(--space-xl)` (24px)
- [ ] Inner component gaps use `var(--space-lg)` (16px)
- [ ] Form field gaps use `var(--space-lg)` (16px) between groups
- [ ] Label-to-input gap is `var(--space-xs)` (4px)
- [ ] No hardcoded pixel values — all spacing uses CSS custom properties

#### Colors
- [ ] All colors use oklch() — no hex, rgb, or hsl values anywhere
- [ ] Text hierarchy: `--text-primary` > `--text-secondary` > `--text-muted`
- [ ] Accent colors from variables: `--accent-blue`, `--accent-red`, `--accent-amber`, `--accent-green`
- [ ] Glass panels use `var(--glass-bg)` and `var(--glass-border)`
- [ ] Category badges follow the stage badge color pattern (oklch with 0.15 alpha bg, full chroma text)

#### Animation
- [ ] Slide-over entry: `slideIn 0.35s var(--ease-out)`
- [ ] Backdrop entry: `fadeIn 0.25s var(--ease-out)`
- [ ] Row hover transitions: `0.15s var(--ease-out)`
- [ ] Delete row exit: `opacity 0 + translateX(20px)` over `0.25s`
- [ ] No animation on initial page load for table content (avoid flash)

---

## 4. Client Progress Page

### Purpose
Customer-facing status page showing their job progress. Auto-updates as stages and milestones change.

### Public Page
- URL: `/status/:token`
- No login required (token-based, like public estimate)
- Displays:
  - Company name and logo
  - Customer name and property address
  - Current pipeline stage (human-readable label)
  - Visual timeline of stages the job has passed through, with dates
  - Upcoming scheduled dates (from work orders)
  - Milestone checklist (from work order milestones) with completion status
  - Photos from completed milestones (if uploaded)

### Stage-to-Timeline Mapping
Pipeline stages map to customer-friendly labels:
- `new` → "Lead Received"
- `contacted` → "Initial Contact"
- `appt_set` → "Inspection Scheduled"
- `inspected` → "Inspection Complete"
- `estimate_sent` → "Estimate Sent"
- `negotiating` → "In Review"
- `sold` → "Contract Signed"
- `in_production` → "In Production"
- `completed` → "Job Complete"

Stages not in this map (e.g. `lost`, `on_hold`) are excluded from the customer-facing timeline.

### Generation
- From lead detail page: "Share Status Page" button generates a token and displays the URL
- Token is one-per-lead, regenerated only on demand

### API

**Public route (on leads router, before authenticate middleware):**
- `GET /api/crm/leads/status/public/:token` — public status data (lead stage, timeline, milestones, scheduled dates)

**Authenticated route (on leads router):**
- `POST /api/crm/leads/:id/status-token` — generate/get status token

Note: The public status route lives on the leads router (not a separate router) to avoid unnecessary new mount points. It must be declared before `router.use(authenticate)`.

---

## 5. Work Order Milestones

### Fixed Milestones
Every work order gets these milestones in order:
1. Permit Pulled
2. Materials Delivered
3. Tear-off
4. Install
5. Cleanup
6. Final Inspection
7. Complete

### Milestone Fields
- `name` — milestone name
- `sort_order` — position in sequence
- `completed` — boolean
- `completed_at` — timestamp when checked
- `photo_url` — optional photo URL

### Photo Upload
Milestone photos use the existing `POST /api/documents` endpoint with `entity_type = 'milestone'` and `entity_id = milestone UUID`. The returned URL is then stored in the milestone's `photo_url` field via `PATCH /api/crm/work-orders/:id/milestones/:milestoneId`. The documents table already supports arbitrary entity references.

### Behavior
- Milestones auto-created when work order is created (in `workOrderService.createWorkOrder`)
- Check milestone → sets `completed_at` to now
- Uncheck → clears `completed_at`
- Optional photo upload per milestone (camera icon next to checkbox)
- Completing all milestones auto-updates work order status to "completed"
- Milestone completions update the client progress page in real-time

### UI
- Work order detail page shows milestone checklist with progress bar
- Progress bar on work order cards in the kanban view (e.g., "4/7")
- Each milestone row: checkbox, name, completion date (if done), photo thumbnail (if uploaded)

### API
- `GET /api/crm/work-orders/:id/milestones` — list milestones for work order
- `PATCH /api/crm/work-orders/:id/milestones/:milestoneId` — toggle complete, set photo_url

---

## 6. Database Schema

### New Tables

```sql
-- Contracts
CREATE TABLE contracts (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id),
  lead_id       UUID REFERENCES leads(id) ON DELETE CASCADE,
  estimate_id   UUID REFERENCES estimates(id),
  template_type VARCHAR(50) NOT NULL DEFAULT 'standard',
  status        VARCHAR(20) NOT NULL DEFAULT 'draft',
  content       JSONB NOT NULL DEFAULT '{}',
  signer_name   VARCHAR(255),
  signature_data TEXT,
  signed_at     TIMESTAMPTZ,
  token         VARCHAR(64) UNIQUE,
  sent_at       TIMESTAMPTZ,
  viewed_at     TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Contract Templates (tenant_id NULL = built-in, is_default TRUE = built-in)
CREATE TABLE contract_templates (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  UUID REFERENCES tenants(id),
  name       VARCHAR(255) NOT NULL,
  type       VARCHAR(50) NOT NULL,
  content    JSONB NOT NULL DEFAULT '{}',
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Expenses
CREATE TABLE expenses (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  UUID NOT NULL REFERENCES tenants(id),
  lead_id    UUID REFERENCES leads(id) ON DELETE CASCADE,
  category   VARCHAR(50) NOT NULL,
  amount     NUMERIC(12,2) NOT NULL,
  date       DATE NOT NULL,
  notes      TEXT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Work Order Milestones
CREATE TABLE work_order_milestones (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  work_order_id UUID NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
  name          VARCHAR(100) NOT NULL,
  sort_order    INTEGER NOT NULL,
  completed     BOOLEAN NOT NULL DEFAULT FALSE,
  completed_at  TIMESTAMPTZ,
  photo_url     TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Client Status Tokens
CREATE TABLE client_status_tokens (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  UUID NOT NULL REFERENCES tenants(id),
  lead_id    UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE UNIQUE,
  token      VARCHAR(64) NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### Seed Built-in Contract Templates
```sql
INSERT INTO contract_templates (tenant_id, name, type, content, is_default) VALUES
  (NULL, 'Standard Roofing Contract', 'standard', '{"sections":[...]}', TRUE),
  (NULL, 'Insurance Restoration Contract', 'insurance', '{"sections":[...]}', TRUE),
  (NULL, 'Financing Contract', 'financing', '{"sections":[...]}', TRUE),
  (NULL, 'Supplement Agreement', 'supplement', '{"sections":[...]}', TRUE);
```

### Indexes
```sql
CREATE INDEX idx_contracts_tenant ON contracts(tenant_id);
CREATE INDEX idx_contracts_lead ON contracts(lead_id);
CREATE INDEX idx_contracts_token ON contracts(token);
CREATE INDEX idx_expenses_tenant ON expenses(tenant_id);
CREATE INDEX idx_expenses_lead ON expenses(lead_id);
CREATE INDEX idx_expenses_date ON expenses(date);
CREATE INDEX idx_wo_milestones_wo ON work_order_milestones(work_order_id);
CREATE INDEX idx_status_tokens_token ON client_status_tokens(token);
```

---

## 7. File Structure (new files)

### Backend
- `server/src/routes/contracts.js` — public routes before auth, then authenticated CRUD
- `server/src/routes/expenses.js` — authenticated CRUD
- `server/src/services/contractService.js` — contract + template business logic
- `server/src/services/expenseService.js` — expense CRUD + job costing queries
- `server/src/db/migrations/add-contracts-expenses-milestones.sql` — all new tables + indexes + seed data

### Frontend
- `client/src/components/ContractsView.jsx` — list + builder
- `client/src/components/PublicContract.jsx` — customer-facing signing page
- `client/src/components/ExpensesView.jsx` — expense list + add modal
- `client/src/components/ClientStatusPage.jsx` — public progress page
- `client/src/api/contracts.js` — API client functions
- `client/src/api/expenses.js` — API client functions

### Modified Files
- `client/src/components/Sidebar.jsx` — grouped navigation with collapsible sections
- `client/src/App.jsx` — new routes for contracts, expenses, public contract, public status
- `client/src/components/LeadDetail.jsx` — contracts tab, expenses tab, status page link
- `client/src/components/WorkOrdersView.jsx` — milestone checklist UI, progress bar
- `client/src/components/EstimatesView.jsx` — "Create Contract" action on accepted estimates
- `server/src/routes/index.js` — mount contracts and expenses routers
- `server/src/routes/leads.js` — add public status route + status token generation
- `server/src/services/workOrderService.js` — auto-create milestones on work order creation
