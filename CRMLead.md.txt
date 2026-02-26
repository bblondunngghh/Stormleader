# StormLeads — CRM & Lead Management Module (Claude Code Prompts)

## Context for Claude Code

This is **Phase 2** of the StormLeads platform. Phase 1 (storm data ingestion, NOAA MESH swath visualization, property overlay, skip trace integration) has already been spec’d and may already be built. This phase adds a full **CRM and lead management system** comparable to JobNimbus, AccuLynx, and Roofr — but with a modern Liquid Glass UI and deeply integrated storm-generated leads.

### Existing Architecture (from Phase 1)

- **Frontend**: React
- **Backend**: Node.js / Express
- **Database**: PostgreSQL with PostGIS
- **Maps**: Mapbox GL JS (storm tracking) + Google Maps API (customer-facing)
- **Auth**: JWT with role-based access control (multi-tenant SaaS)
- **Billing**: Stripe
- **Key tables already exist**: `tenants`, `users`, `storm_events`, `properties`, `leads`, `outreach_log`, `skip_trace_usage`

The `leads` table already has a basic status field: `New → Contacted → Appointment Set → Inspected → Estimate Sent → Sold → Completed`. This phase expands that into a full CRM.

-----

## Design System: Liquid Glass + oklch

### CRITICAL — Read this before writing ANY CSS

Every component in this application must follow the **iOS 26 Liquid Glass** aesthetic using **oklch color space**. This is non-negotiable. The app should feel like a premium Apple product, not a generic SaaS dashboard.

### Liquid Glass Core Principles

```css
/* === LIQUID GLASS DESIGN TOKENS === */
:root {
/* oklch color palette — perceptually uniform, beautiful gradients */
--glass-primary: oklch(0.65 0.15 250); /* deep blue */
--glass-primary-light: oklch(0.78 0.10 250); /* lighter blue */
--glass-accent: oklch(0.72 0.18 160); /* teal-green accent */
--glass-warning: oklch(0.75 0.16 80); /* warm amber */
--glass-danger: oklch(0.65 0.20 25); /* red */
--glass-success: oklch(0.72 0.17 145); /* green */
--glass-surface: oklch(0.98 0.005 250 / 0.6); /* translucent white surface */
--glass-surface-hover: oklch(0.96 0.008 250 / 0.7);
--glass-surface-active: oklch(0.94 0.01 250 / 0.8);
--glass-border: oklch(0.95 0.005 250 / 0.3); /* subtle border */
--glass-text-primary: oklch(0.20 0.02 250); /* near-black */
--glass-text-secondary: oklch(0.45 0.02 250); /* muted */
--glass-text-tertiary: oklch(0.60 0.015 250); /* light gray */

/* Dark mode variants */
--glass-surface-dark: oklch(0.18 0.01 250 / 0.6);
--glass-surface-dark-hover: oklch(0.22 0.015 250 / 0.7);
--glass-border-dark: oklch(0.30 0.01 250 / 0.3);
--glass-text-primary-dark: oklch(0.92 0.005 250);

/* Glass effects */
--glass-blur: 20px;
--glass-blur-heavy: 40px;
--glass-shadow: 0 8px 32px oklch(0.15 0.02 250 / 0.12);
--glass-shadow-elevated: 0 16px 48px oklch(0.12 0.03 250 / 0.18);
--glass-inner-glow: inset 0 1px 0 oklch(1 0 0 / 0.15);
--glass-radius: 16px;
--glass-radius-lg: 24px;
--glass-radius-sm: 10px;

/* Typography */
--font-display: 'SF Pro Display', -apple-system, system-ui, sans-serif;
--font-body: 'SF Pro Text', -apple-system, system-ui, sans-serif;
--font-mono: 'SF Mono', 'JetBrains Mono', monospace;
}

/* === BASE GLASS PANEL === */
.glass-panel {
background: var(--glass-surface);
backdrop-filter: blur(var(--glass-blur));
-webkit-backdrop-filter: blur(var(--glass-blur));
border: 1px solid var(--glass-border);
border-radius: var(--glass-radius);
box-shadow: var(--glass-shadow), var(--glass-inner-glow);
transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.glass-panel:hover {
background: var(--glass-surface-hover);
box-shadow: var(--glass-shadow-elevated), var(--glass-inner-glow);
}

/* === GLASS CARD (for lead cards, stat cards, etc) === */
.glass-card {
background: var(--glass-surface);
backdrop-filter: blur(var(--glass-blur));
-webkit-backdrop-filter: blur(var(--glass-blur));
border: 1px solid var(--glass-border);
border-radius: var(--glass-radius);
box-shadow: var(--glass-shadow), var(--glass-inner-glow);
position: relative;
overflow: hidden;
}

/* Specular highlight — simulates light refraction on glass edge */
.glass-card::before {
content: '';
position: absolute;
top: 0;
left: 0;
right: 0;
height: 1px;
background: linear-gradient(
90deg,
oklch(1 0 0 / 0),
oklch(1 0 0 / 0.4),
oklch(1 0 0 / 0)
);
}

/* === GLASS BUTTON === */
.glass-button {
background: var(--glass-surface);
backdrop-filter: blur(12px);
-webkit-backdrop-filter: blur(12px);
border: 1px solid var(--glass-border);
border-radius: var(--glass-radius-sm);
padding: 10px 20px;
color: var(--glass-text-primary);
font-family: var(--font-body);
font-weight: 500;
cursor: pointer;
transition: all 0.2s ease;
box-shadow: 0 2px 8px oklch(0.15 0.02 250 / 0.08), var(--glass-inner-glow);
}

.glass-button:hover {
background: var(--glass-surface-hover);
transform: translateY(-1px);
box-shadow: 0 4px 16px oklch(0.15 0.02 250 / 0.12), var(--glass-inner-glow);
}

.glass-button-primary {
background: oklch(0.55 0.15 250 / 0.85);
color: oklch(0.98 0.005 250);
border-color: oklch(0.60 0.12 250 / 0.4);
}

/* === KANBAN COLUMN === */
.kanban-column {
background: oklch(0.96 0.005 250 / 0.35);
backdrop-filter: blur(16px);
-webkit-backdrop-filter: blur(16px);
border: 1px solid oklch(0.90 0.005 250 / 0.2);
border-radius: var(--glass-radius-lg);
min-width: 300px;
}

/* === STATUS PILL BADGES (oklch for perceptually uniform colors) === */
.status-new { background: oklch(0.80 0.12 250 / 0.2); color: oklch(0.45 0.15 250); }
.status-contacted { background: oklch(0.82 0.10 200 / 0.2); color: oklch(0.45 0.12 200); }
.status-appointment { background: oklch(0.82 0.12 80 / 0.2); color: oklch(0.50 0.15 80); }
.status-inspected { background: oklch(0.82 0.12 55 / 0.2); color: oklch(0.50 0.15 55); }
.status-estimate-sent { background: oklch(0.82 0.14 310 / 0.2); color: oklch(0.45 0.16 310); }
.status-sold { background: oklch(0.82 0.15 145 / 0.2); color: oklch(0.40 0.17 145); }
.status-completed { background: oklch(0.85 0.05 250 / 0.2); color: oklch(0.40 0.06 250); }
.status-lost { background: oklch(0.80 0.06 250 / 0.15); color: oklch(0.55 0.03 250); }
```

### Design Rules

1. **NO solid backgrounds** — every surface should have some translucency and backdrop-filter blur
1. **NO harsh borders** — borders should be subtle, semi-transparent, and use oklch with alpha
1. **NO flat shadows** — shadows should have color (tinted with oklch), not just gray
1. **Specular highlights** — glass elements should have a subtle light reflection on their top edge (gradient from transparent to white to transparent)
1. **Smooth transitions** — use `cubic-bezier(0.4, 0, 0.2, 1)` for material-like motion
1. **oklch everywhere** — never use hex, rgb, or hsl. All colors in oklch()
1. **Depth through layering** — panels on top of panels, each with slightly different blur and opacity
1. **The background matters** — the page background should be a rich gradient or subtle pattern so the glass effects have something to refract/blur
1. **No Inter, no Roboto** — use SF Pro Display/Text via system fonts, or if those aren’t available, use something with character like ‘Plus Jakarta Sans’, ‘Outfit’, or ‘General Sans’ from Google Fonts
1. **Dark mode from day one** — use CSS custom properties so dark mode is a theme swap, not a rewrite

-----

## PROMPT 1: Database Schema Expansion for CRM

```
Expand the existing StormLeads PostgreSQL database schema to support a full CRM and lead management system. The existing tables (tenants, users, storm_events, properties, leads, outreach_log, skip_trace_usage) are already in place. DO NOT recreate them — add to them and create new tables.

### Modify existing `leads` table — add these columns:
- `assigned_to` (UUID, FK to users.id) — which sales rep owns this lead
- `priority` (enum: 'hot', 'warm', 'cold', 'dead') — lead temperature
- `source` (enum: 'storm_auto', 'manual', 'referral', 'website', 'door_knock', 'phone', 'other') — where the lead came from
- `tags` (text array) — flexible tagging system
- `estimated_value` (decimal) — estimated job value in dollars
- `actual_value` (decimal) — actual closed value
- `notes` (text) — free-form notes
- `last_contact_at` (timestamptz) — when was this lead last contacted
- `next_follow_up` (timestamptz) — scheduled follow-up date
- `lost_reason` (text) — if status = 'lost', why?

### Expand the status enum to include:
'new', 'contacted', 'appointment_set', 'inspected', 'estimate_sent', 'negotiating', 'sold', 'in_production', 'completed', 'lost', 'on_hold'

### New table: `contacts`
A lead can have multiple contacts (homeowner + spouse, property manager, etc.)
- id (UUID, PK)
- lead_id (UUID, FK to leads)
- tenant_id (UUID, FK to tenants)
- first_name, last_name (varchar)
- phone (varchar)
- email (varchar)
- is_primary (boolean, default false)
- source (enum: 'skip_trace', 'manual', 'website_form')
- do_not_contact (boolean, default false)
- created_at, updated_at (timestamptz)

### New table: `activities`
Every interaction with a lead gets logged as an activity.
- id (UUID, PK)
- lead_id (UUID, FK to leads)
- user_id (UUID, FK to users — who performed the activity)
- tenant_id (UUID, FK to tenants)
- type (enum: 'call', 'email', 'text', 'door_knock', 'voicemail_drop', 'meeting', 'inspection', 'note', 'status_change', 'assignment', 'system')
- direction (enum: 'inbound', 'outbound', null) — for calls/emails/texts
- subject (varchar) — brief summary
- body (text) — details, call notes, email content
- duration_seconds (integer) — for calls
- outcome (enum: 'connected', 'no_answer', 'voicemail', 'busy', 'wrong_number', 'appointment_set', 'not_interested', null)
- metadata (jsonb) — flexible data (email headers, call SID, etc.)
- created_at (timestamptz)

Index on (lead_id, created_at DESC) for activity feed performance.
Index on (tenant_id, type, created_at) for reporting.

### New table: `estimates`
- id (UUID, PK)
- lead_id (UUID, FK to leads)
- tenant_id (UUID, FK to tenants)
- created_by (UUID, FK to users)
- estimate_number (varchar, auto-incrementing per tenant like EST-001)
- status (enum: 'draft', 'sent', 'viewed', 'accepted', 'declined', 'expired')
- line_items (jsonb) — array of {description, quantity, unit_price, total}
- subtotal, tax_amount, total (decimal)
- valid_until (date)
- notes (text)
- sent_at, viewed_at, accepted_at (timestamptz)
- signature_url (varchar) — e-signature image
- created_at, updated_at (timestamptz)

### New table: `documents`
Photos, contracts, inspection reports attached to leads.
- id (UUID, PK)
- lead_id (UUID, FK to leads)
- tenant_id (UUID, FK to tenants)
- uploaded_by (UUID, FK to users)
- type (enum: 'photo', 'contract', 'inspection_report', 'estimate', 'invoice', 'insurance_doc', 'other')
- filename (varchar)
- file_url (varchar) — S3 or similar storage URL
- file_size (integer)
- mime_type (varchar)
- description (text)
- tags (text array)
- created_at (timestamptz)

### New table: `tasks`
To-do items linked to leads.
- id (UUID, PK)
- lead_id (UUID, FK to leads, nullable — tasks can be standalone)
- tenant_id (UUID, FK to tenants)
- assigned_to (UUID, FK to users)
- created_by (UUID, FK to users)
- title (varchar)
- description (text)
- due_date (timestamptz)
- priority (enum: 'low', 'medium', 'high', 'urgent')
- status (enum: 'pending', 'in_progress', 'completed', 'cancelled')
- completed_at (timestamptz)
- created_at, updated_at (timestamptz)

### New table: `pipeline_stages`
Customizable per tenant — let each roofing company define their own pipeline.
- id (UUID, PK)
- tenant_id (UUID, FK to tenants)
- name (varchar) — e.g., 'New Lead', 'Appointment Set'
- slug (varchar) — URL-safe version
- position (integer) — ordering
- color (varchar) — oklch color string for UI
- is_won (boolean) — marks this as a "won" stage
- is_lost (boolean) — marks this as a "lost" stage
- is_default (boolean) — new leads start here
- created_at, updated_at (timestamptz)

Seed default stages for new tenants: New → Contacted → Appointment Set → Inspected → Estimate Sent → Negotiating → Sold → In Production → Completed (+ Lost as a lost stage)

### New table: `automations`
Trigger actions based on lead status changes (future feature but schema now).
- id (UUID, PK)
- tenant_id (UUID, FK)
- name (varchar)
- trigger_type (enum: 'status_change', 'time_delay', 'no_activity', 'assignment')
- trigger_config (jsonb) — e.g., {from_status: 'new', to_status: 'contacted'}
- action_type (enum: 'send_email', 'send_sms', 'create_task', 'assign_user', 'change_status', 'webhook')
- action_config (jsonb) — e.g., {template_id: '...', delay_minutes: 30}
- is_active (boolean)
- created_at, updated_at (timestamptz)

### Views to create:
1. `lead_summary_view` — joins leads + contacts (primary) + latest activity + assigned user name + property details + storm event info. This is what the kanban board and lead list query.
2. `pipeline_metrics_view` — counts leads per stage per tenant, average time in each stage, conversion rates between stages.

### Indexes to create:
- leads: (tenant_id, status), (tenant_id, assigned_to, status), (tenant_id, created_at DESC)
- activities: (lead_id, created_at DESC), (tenant_id, user_id, created_at DESC)
- tasks: (tenant_id, assigned_to, status, due_date)
- contacts: (lead_id), (tenant_id, email), (tenant_id, phone)

Write the migration files. Use UUID v7 for all primary keys (time-sortable). Add appropriate ON DELETE constraints (CASCADE for child records, SET NULL for optional references).
```

-----

## PROMPT 2: CRM API Endpoints

```
Build the Express.js REST API routes for the StormLeads CRM module. All routes are tenant-scoped — the authenticated user's tenant_id is extracted from their JWT token. Use middleware for auth and tenant isolation.

### Lead Routes (prefix: /api/leads)

GET /api/leads
- Query params: status, assigned_to, priority, source, search (name/address), storm_event_id, sort_by, sort_order, page, limit, date_from, date_to, tags
- Returns: paginated lead_summary_view results with total count
- Include: primary contact info, last activity date, assigned user name, property address, storm event date/hail size

GET /api/leads/:id
- Returns: full lead detail with ALL contacts, recent activities (last 20), documents, tasks, estimates, property info, storm event info

POST /api/leads
- Body: property info, contact info, source, notes, assigned_to, priority, tags
- Auto-sets status to default pipeline stage
- Creates initial activity log entry (type: 'system', subject: 'Lead created')
- If source is 'storm_auto', links to storm_event_id

PATCH /api/leads/:id
- Partial update: status, priority, assigned_to, tags, notes, estimated_value, next_follow_up, lost_reason
- When status changes: auto-create activity (type: 'status_change', subject: 'Status changed from X to Y')
- When assigned_to changes: auto-create activity (type: 'assignment', subject: 'Assigned to [user name]')

DELETE /api/leads/:id (soft delete — set deleted_at timestamp)

POST /api/leads/bulk-assign
- Body: { lead_ids: [], assigned_to: userId }
- Bulk assign leads to a rep

POST /api/leads/bulk-status
- Body: { lead_ids: [], status: 'contacted' }
- Bulk status update

GET /api/leads/:id/timeline
- Returns: all activities for a lead, sorted by created_at DESC
- Paginated

### Contact Routes (prefix: /api/leads/:leadId/contacts)

GET — list all contacts for a lead
POST — add a contact
PATCH /:contactId — update contact
DELETE /:contactId — remove contact
PATCH /:contactId/primary — set as primary contact

### Activity Routes (prefix: /api/activities)

POST /api/activities
- Body: lead_id, type, direction, subject, body, duration_seconds, outcome
- Automatically updates lead.last_contact_at if type is a contact activity (call, email, text, door_knock)
- Automatically updates lead.next_follow_up if provided

GET /api/leads/:leadId/activities — paginated activity feed for a lead
GET /api/activities/recent — recent activities across all leads for the logged-in user (their activity feed)

### Task Routes (prefix: /api/tasks)

GET /api/tasks — list tasks for the logged-in user, filterable by status, due_date range, priority, lead_id
POST /api/tasks — create task
PATCH /api/tasks/:id — update task (title, description, due_date, priority, status, assigned_to)
DELETE /api/tasks/:id

GET /api/tasks/overdue — tasks past due date that aren't completed
GET /api/tasks/today — tasks due today

### Estimate Routes (prefix: /api/estimates)

GET /api/estimates — list estimates, filterable by status, lead_id
POST /api/estimates — create estimate with line items
PATCH /api/estimates/:id — update estimate
POST /api/estimates/:id/send — mark as sent, trigger email to contact
POST /api/estimates/:id/duplicate — clone an estimate

### Document Routes (prefix: /api/documents)

POST /api/documents — upload file (multipart form, store to S3/local, create record)
GET /api/leads/:leadId/documents — list documents for a lead
DELETE /api/documents/:id — remove document

### Pipeline Routes (prefix: /api/pipeline)

GET /api/pipeline/stages — get tenant's pipeline stages (ordered)
POST /api/pipeline/stages — create new stage
PATCH /api/pipeline/stages/:id — update stage (name, color, position)
DELETE /api/pipeline/stages/:id — delete stage (must reassign leads first)
PATCH /api/pipeline/stages/reorder — body: [{id, position}] — reorder stages

GET /api/pipeline/metrics — conversion rates, avg time per stage, leads per stage, total pipeline value

### Dashboard Routes (prefix: /api/dashboard)

GET /api/dashboard/stats
- Returns: total leads, leads by status, leads by priority, new leads today/week/month, conversion rate, total pipeline value, avg time to close, leads by source
- Filterable by date range, assigned_to

GET /api/dashboard/leaderboard
- Returns: per-rep stats (leads assigned, contacted, appointments set, closed, revenue)
- Filterable by date range

GET /api/dashboard/storm-roi
- Returns: per storm event — leads generated, skip trace cost, leads contacted, appointments, closed jobs, revenue, ROI

Use proper error handling middleware. Return consistent JSON responses: { success: boolean, data: any, error?: string, meta?: { page, limit, total } }. Use database transactions for operations that touch multiple tables.
```

-----

## PROMPT 3: Kanban Board Component (Liquid Glass UI)

```
Build a React Kanban board component for the StormLeads CRM lead pipeline. This is the primary view for managing leads — think Trello/JobNimbus board but with iOS 26 Liquid Glass aesthetics and oklch colors.

### Design Requirements — LIQUID GLASS AESTHETIC

The page background should be a rich gradient that the glass panels blur over:
```css
body {
background: linear-gradient(
135deg,
oklch(0.25 0.05 250) 0%,
oklch(0.18 0.04 280) 30%,
oklch(0.22 0.06 220) 60%,
oklch(0.15 0.03 260) 100%
);
min-height: 100vh;
}
```

Use a dark theme by default — dark backgrounds make the glass effects pop. Light glass panels floating on dark surfaces.

**Column styling:**

- Each kanban column is a glass panel with subtle translucency
- Column header shows stage name + lead count badge
- The column background should be slightly different per stage (tinted with the stage’s oklch color at very low opacity)
- Columns should scroll vertically independently

**Lead card styling:**

- Each lead card is a glass-card with the specular highlight on top
- Show: property address (bold), owner name, hail size badge, estimated value, assigned rep avatar, days in stage, priority indicator (colored dot)
- On hover: slight scale(1.02) and elevated shadow
- Priority indicator: ‘hot’ = pulsing oklch red dot, ‘warm’ = amber, ‘cold’ = blue, ‘dead’ = gray

**Drag and drop:**

- Use @dnd-kit/core and @dnd-kit/sortable for drag-and-drop
- When a card is being dragged, it should have a glass-like “lifted” appearance with stronger blur and shadow
- Drop targets should glow with the destination column’s color
- On drop: PATCH /api/leads/:id with new status, optimistic UI update

**Top toolbar (glass panel):**

- Search input (glass style input with backdrop blur)
- Filter dropdowns: By rep, By priority, By source, By storm event
- Sort: Newest, Oldest, Highest value, Priority
- View toggle: Kanban | List | Map (map shows leads on the storm map)
- “Add Lead” button (glass-button-primary)

**Empty state:**

- When a column has no leads, show a subtle dashed border area with ghost text
- Should still accept drops

**Animations:**

- Cards entering a column: fade in + slide down with stagger
- Cards leaving: fade out quickly
- Column count badge: animate number changes
- Use cubic-bezier(0.4, 0, 0.2, 1) for all transitions

### Functional Requirements

- Fetch pipeline stages from GET /api/pipeline/stages
- Fetch leads from GET /api/leads with current filters
- Group leads by status into columns
- Drag card between columns → PATCH status
- Drag card within column → reorder (store position)
- Click card → open lead detail slide-over panel
- Right-click card → context menu (assign, change priority, add note, call, delete)
- Column header click → expand/collapse column
- Keyboard accessible: arrow keys to navigate, Enter to open, Escape to close

### Component Structure

```
<KanbanBoard>
<KanbanToolbar filters={} onFilterChange={} />
<KanbanColumns>
{stages.map(stage => (
<KanbanColumn stage={stage} leads={leadsForStage}>
{leads.map(lead => (
<LeadCard lead={lead} onClick={} onDragStart={} />
))}
</KanbanColumn>
))}
</KanbanColumns>
<LeadDetailPanel lead={selectedLead} isOpen={} onClose={} />
</KanbanBoard>
```

Use React Query (TanStack Query) for data fetching with optimistic updates on drag-and-drop. Keep the kanban state in a useReducer for predictable updates.

```
---

## PROMPT 4: Lead Detail Panel (Slide-Over)
```

Build a Lead Detail slide-over panel component for StormLeads. When a user clicks a lead card on the kanban board or lead list, this panel slides in from the right side covering about 60% of the screen width. It shows everything about the lead.

### Design — Liquid Glass

The panel itself is a large glass panel that slides over the kanban board:

- Background: oklch(0.14 0.02 250 / 0.92) with backdrop-filter: blur(40px)
- Left edge: subtle 1px border with oklch(0.30 0.01 250 / 0.3)
- Entrance animation: slide from right with slight opacity fade, cubic-bezier(0.32, 0.72, 0, 1) — Apple’s spring curve
- Overlay behind it: oklch(0 0 0 / 0.3)
- Close button: glass circle with X, top right
- Panel should be scrollable

### Panel Layout (top to bottom):

**Header section:**

- Property address (large, bold)
- Status badge (glass pill with stage color) — clickable to change status via dropdown
- Priority badge (hot/warm/cold) — clickable to change
- Assigned rep avatar + name — clickable to reassign
- “Storm Generated” badge if source is storm_auto (with storm date + hail size)
- Quick action buttons row: Call, Email, Text, Log Activity, Create Task, Create Estimate

**Contact info section (glass card):**

- Primary contact: name, phone (click to call), email (click to compose)
- Additional contacts listed below
- “Add Contact” button
- Skip trace info: source, accuracy score, DNC status
- Each phone number shows a “Call” and “Text” icon button

**Property details section (glass card):**

- Address, city, state, zip
- Owner name (from TCAD/county data)
- Year built, square footage, property value
- Homestead exempt: yes/no
- Roof age estimate (current year - year built, but note this is structure age not roof age)
- Mini map showing property location (Google Maps static image or small embedded Mapbox)
- If from a storm: hail size at this location, wind speed, storm date

**Storm context section (glass card, only if storm-generated lead):**

- Storm event date and summary
- Hail size at this specific property’s coordinates
- Wind speed/gusts
- Small swath map showing this property’s position within the swath
- Damage probability score (if available)
- Link to full storm event view

**Financial section (glass card):**

- Estimated job value (editable inline)
- Actual value (if sold)
- Estimates sent (list with status badges)
- “Create Estimate” button

**Activity timeline section:**

- Chronological feed of all activities (calls, emails, texts, status changes, notes, tasks)
- Each activity shows: icon (by type), user who did it, timestamp, details
- Activity icons should be glass circles with oklch tints per type:
- Call: oklch(0.65 0.15 145) green
- Email: oklch(0.65 0.15 250) blue
- Text: oklch(0.65 0.15 200) cyan
- Door knock: oklch(0.65 0.15 80) amber
- Note: oklch(0.65 0.10 250) gray-blue
- Status change: oklch(0.65 0.12 310) purple
- System: oklch(0.65 0.05 250) muted
- “Log Activity” button opens a modal to add a new activity
- Infinite scroll for older activities

**Tasks section:**

- List of tasks linked to this lead
- Show: title, due date, assigned to, priority, status
- Overdue tasks highlighted with oklch danger color
- “Add Task” inline form

**Documents section:**

- Grid of document thumbnails (photos show preview, others show file icon)
- Upload button with drag-and-drop zone
- Filter by type: Photos, Contracts, Inspection Reports, Insurance Docs

### Quick Actions

When “Call” is clicked:

1. Opens a “Log Call” modal
1. User can select which contact/number to call
1. After call: log outcome (connected, no answer, voicemail, etc.), add notes, set follow-up date
1. Creates an activity record

When “Log Activity” is clicked:

- Modal with: type selector, direction, subject, body (rich text), outcome, follow-up date
- Should auto-populate lead_id

All sections should be collapsible. Remember scroll position between lead selections. Use React Query for data fetching — invalidate lead detail queries when activities/contacts/documents change.

```
---

## PROMPT 5: Lead List View (Table)
```

Build a Lead List table view as an alternative to the Kanban board. This is for power users who want to see and manage many leads at once in a spreadsheet-like format.

### Design — Liquid Glass Table

The table should feel like a premium data grid floating on glass:

- Table container: glass-panel with blur
- Header row: slightly more opaque glass surface, sticky on scroll
- Data rows: alternating very subtle opacity differences (oklch surface at 0.4 vs 0.45 alpha)
- Row hover: background lightens smoothly, slight left border highlight with stage color
- Selected row: left border 3px solid with primary color, background slightly more opaque
- Cell text: var(–font-body), clear and readable — DO NOT sacrifice readability for glass effects

**Columns (reorderable, resizable, toggleable):**

1. Checkbox (for bulk actions)
1. Status (color-coded pill badge)
1. Priority (colored dot + label)
1. Property Address
1. Owner/Contact Name
1. Phone (click to call)
1. Email (click to compose)
1. Source (badge: Storm, Manual, Referral, etc.)
1. Storm Event (date + hail size if applicable)
1. Estimated Value ($)
1. Assigned Rep (avatar + name)
1. Last Contact (relative time: “2 hours ago”, “3 days ago”)
1. Next Follow-up (date, highlighted if overdue)
1. Days in Stage
1. Created Date
1. Tags

**Toolbar (glass panel, above table):**

- Search input with glass styling
- Filter chips: active filters shown as removable glass pills
- Quick filters: “My Leads”, “Hot Leads”, “Needs Follow-up”, “Overdue”, “Unassigned”
- Bulk action bar: appears when checkboxes are selected — Assign, Change Status, Change Priority, Export, Delete
- Column customization button (opens drawer to toggle/reorder columns)
- Export CSV button
- View toggle: List | Kanban | Map

**Sorting:**

- Click column header to sort (ascending/descending)
- Active sort indicated by arrow icon and slightly highlighted header

**Pagination:**

- Glass-styled pagination controls at bottom
- Show: “Showing 1-25 of 847 leads”
- Page size selector: 25, 50, 100

**Row click:**

- Opens the Lead Detail slide-over panel (same component from Prompt 4)

**Inline editing:**

- Status: click to get dropdown
- Priority: click to cycle through options
- Assigned Rep: click to get user picker
- Estimated Value: click to edit inline
- Next Follow-up: click to get date picker

**Performance:**

- Use virtualized rendering for large datasets (react-window or TanStack Virtual)
- Only render visible rows
- Debounce search input (300ms)
- Cache filter results with React Query

All filters, sort, and pagination should update the URL query params so the view is shareable/bookmarkable.

```
---

## PROMPT 6: Dashboard & Analytics (Home Screen)
```

Build the main CRM Dashboard — this is the first thing users see when they log in. It should give an immediate overview of their pipeline health, team performance, and storm activity.

### Design — Liquid Glass Dashboard

This is the showcase page. The background should be a rich, deep gradient with subtle animated movement (CSS only — slowly shifting gradient angles or positions). Glass stat cards and charts float on top.

**Page layout:**

- Top: greeting + date (“Good morning, Brandon — Tuesday, Feb 24”)
- Row 1: Key metric stat cards (4 across)
- Row 2: Pipeline funnel chart + Storm activity map (side by side)
- Row 3: Recent activity feed + Tasks due today (side by side)
- Row 4: Team leaderboard + Storm ROI table

### Stat Cards (glass-card with large number + label + trend indicator):

1. **Pipeline Value** — total estimated value of all open leads, with arrow showing week-over-week change
1. **New Leads This Week** — count, sourced breakdown (storm vs manual)
1. **Close Rate** — percentage of leads that reached “Sold” status, trend arrow
1. **Avg Days to Close** — from lead creation to “Sold” status

Each card should have:

- Large number (32px+ font, bold)
- Label below in muted text
- Trend indicator: green arrow up / red arrow down with percentage
- Subtle accent line at top in oklch color
- Hover: slight elevation increase

### Pipeline Funnel Visualization:

A horizontal funnel showing how many leads are in each stage:

- Visual bars proportional to count
- Each bar colored with the pipeline stage’s oklch color
- Hover shows: count, total value, avg days in stage
- Click to filter the Kanban/List to that stage
- Build with SVG or a charting library (Recharts) — style to match glass aesthetic
- The chart container is a glass panel

### Storm Activity Map (mini version):

A small Mapbox map showing recent storm events in the tenant’s service area:

- Swath polygons with semi-transparent fills
- Click a swath to see: storm date, hail size, leads generated, leads contacted
- Time range selector: Last 7 days, 30 days, 90 days, Year
- Glass panel container with rounded corners

### Recent Activity Feed:

A scrollable list of the most recent activities across all leads:

- Show: activity type icon, “Brandon called John Smith at 123 Oak St — Connected, appointment set for Friday”, timestamp
- Filter by: My activities, All team activities
- Click to open the lead detail panel
- Glass panel container, max height with scroll

### Tasks Due Today:

- Prioritized list of tasks due today or overdue
- Show: task title, linked lead (if any), priority badge, due time
- Checkbox to mark complete (strikes through + fade animation)
- Overdue tasks highlighted with danger color glow
- Glass panel container

### Team Leaderboard:

Table showing per-rep performance:

- Columns: Rep Name, Leads Assigned, Contacted, Appointments, Inspections, Estimates Sent, Jobs Sold, Revenue, Close Rate
- Sortable by any column
- Highlight the current user’s row
- Time range filter
- Glass table styling from Prompt 5

### Storm ROI Table:

Table showing return on investment per storm event:

- Columns: Storm Date, Location, Hail Size, Properties in Swath, Skip Traced, Cost, Leads Generated, Contacted, Appointments, Sold, Revenue, ROI %
- Sortable, filterable by date range
- Highlight profitable storms in green, unprofitable in red
- Glass table styling

### Data fetching:

- GET /api/dashboard/stats for stat cards
- GET /api/dashboard/leaderboard for team table
- GET /api/dashboard/storm-roi for ROI table
- GET /api/activities/recent for activity feed
- GET /api/tasks/today for tasks
- GET /api/pipeline/metrics for funnel
- Use React Query with appropriate stale times (stats: 30s, activities: 10s)

### Responsiveness:

- Desktop: full layout as described
- Tablet: stack row 2 and row 3 vertically, shrink stat cards to 2x2 grid
- Mobile: single column, stat cards horizontal scroll

```
---

## PROMPT 7: Activity Logging & Communication Hub
```

Build the activity logging system for StormLeads — this handles how users record calls, emails, texts, door knocks, and other interactions with leads.

### Log Activity Modal (Liquid Glass)

When user clicks “Log Activity” on a lead (from kanban card context menu, lead detail panel, or activity feed), show a glass modal:

- Modal backdrop: oklch(0 0 0 / 0.4) with backdrop blur
- Modal container: glass panel, max-width 560px, centered
- Entrance animation: scale from 0.95 to 1 + opacity fade, fast spring curve

**Form fields:**

1. **Activity Type** — segmented control (glass pill buttons in a row):
📞 Call | 📧 Email | 💬 Text | 🚪 Door Knock | 📝 Note | 📋 Meeting | 🔍 Inspection
1. **Direction** (for Call/Email/Text only) — toggle: Inbound | Outbound
1. **Contact** — dropdown of lead’s contacts (pre-select primary)
1. **Subject** — text input, auto-suggested based on type:
- Call → “Phone call with [contact name]”
- Door Knock → “Door knock at [address]”
1. **Outcome** (for calls/door knocks) — radio buttons:
✅ Connected | 📵 No Answer | 📞 Voicemail | 🚫 Not Interested | 📅 Appointment Set | ❌ Wrong Number
1. **Notes** — textarea, auto-expanding, with rich formatting support (bold, links)
1. **Duration** (for calls) — input in minutes
1. **Follow-up** — date/time picker: “Set next follow-up”
When set: creates a task and updates lead.next_follow_up
1. **Mood/Sentiment** (optional) — 3 buttons: 😊 Positive | 😐 Neutral | 😟 Negative

**Submit behavior:**

- POST /api/activities with all fields
- Updates lead.last_contact_at
- If outcome is ‘appointment_set’, auto-change lead status to ‘appointment_set’
- If follow-up is set, create task
- Close modal with success animation (glass card shrinks + fades)
- Toast notification: “Activity logged” (glass toast in top-right)

### Quick Log Buttons

On each lead card and in the lead detail panel, provide quick-action buttons that skip the full modal:

- **Quick Call Log** — one click opens a minimal form: just outcome + notes + follow-up
- **Quick Note** — one click opens just a text input, saves as type=‘note’
- **Quick Status Change** — dropdown to change status, auto-logs activity

### Toast Notifications (Glass Style)

Build a reusable toast notification system:

- Position: top-right, stacked
- Glass panel style with backdrop blur
- Auto-dismiss after 4 seconds with progress bar
- Types: success (green glow), error (red glow), info (blue glow), warning (amber glow)
- Entrance: slide in from right + scale
- Exit: slide out right + fade
- Glow effect uses oklch box-shadow matching the type color

All styles should use oklch colors and glass effects. Form inputs should have glass styling: translucent background, subtle border, focus ring with oklch primary color glow.

```
---

## PROMPT 8: Estimate Builder
```

Build an Estimate/Proposal builder for StormLeads. This lets roofing companies create professional estimates from within the CRM and send them to homeowners for e-signature.

### Estimate Editor (Liquid Glass)

**Full-page view** (not a modal — estimates need screen real estate):

- Left side (60%): estimate form/editor
- Right side (40%): live preview of how the estimate will look to the homeowner

### Editor (left side, glass panel):

**Header fields:**

- Estimate number (auto-generated: EST-001, EST-002… per tenant)
- Lead/Property: auto-populated if created from a lead
- Date created, Valid until (date picker)

**Company info (auto-filled from tenant profile):**

- Company name, logo, address, phone, email, license number

**Customer info (auto-filled from lead/contact):**

- Name, address, phone, email

**Line Items section:**

- Editable table with glass styling
- Columns: Description | Quantity | Unit | Unit Price | Total
- Each row is a glass card within the table
- “Add Line Item” button adds a new row with smooth animation
- Common presets dropdown: “Tear Off & Replace (per sq)”, “Ridge Cap”, “Drip Edge”, “Ice & Water Shield”, “Flashing”, “Pipe Boot”, “Skylights”, “Ventilation”, etc.
- Drag to reorder rows
- Swipe/click to delete with confirmation

**Section grouping:**

- Line items can be grouped into sections: “Roof”, “Gutters”, “Siding”, “Misc”
- Each section has its own subtotal
- Collapsible sections

**Totals:**

- Subtotal (auto-calculated)
- Tax rate input (percentage) + tax amount
- Discount (percentage or flat amount)
- **Total (large, bold)**

**Notes/Terms:**

- Rich text area for scope of work description
- Terms & conditions (editable, with default template)
- Warranty information

**Financing option (optional):**

- Toggle to include financing
- Monthly payment estimate based on total and selected term

### Preview (right side, glass panel):

A live-updating preview of the estimate as a clean, branded document:

- Company logo and info at top
- Customer info
- Line items table (professional formatting)
- Totals section
- Terms at bottom
- “This is how it will look to your customer” label

The preview should update in real-time as the user edits the form.

### Actions:

- **Save as Draft** — saves without sending
- **Send to Customer** — opens a modal to compose an email with the estimate attached as a PDF or a link to a web-viewable version
- **Download PDF** — generates a PDF of the estimate
- **Duplicate** — clones the estimate for quick variations

### Customer-facing estimate view:

When a customer receives the estimate link, they see:

- A clean, branded page (NOT the glass admin UI — this should be professional and simple)
- Company branding
- Estimate details
- Accept/Decline buttons
- E-signature pad (canvas-based signature capture)
- When accepted: status updates, activity is logged, notification sent to the rep

### Data:

- POST /api/estimates — create
- PATCH /api/estimates/:id — update
- POST /api/estimates/:id/send — send to customer
- GET /api/estimates/:id/public/:token — customer-facing view (no auth required, uses signed token)

Line items stored as JSONB in the estimates table. Template presets stored in a `estimate_templates` table per tenant.

```
---

## PROMPT 9: Team Management & Notifications
```

Build the team management and notification system for StormLeads.

### Team Management Page (Liquid Glass)

Accessible to tenant admins. Shows all users in the tenant organization.

**User cards (glass cards in a grid):**

- Avatar (initials-based if no photo, with oklch gradient background)
- Name, email, role (Admin / Manager / Sales Rep)
- Performance stats: leads assigned, close rate, revenue this month
- Status indicator: online (green dot) / offline (gray)
- Actions: Edit Role, Reassign Leads, Deactivate

**Invite new user:**

- Glass modal with email input + role selector
- Sends invitation email with signup link
- Pending invites shown with “Pending” badge

**Role permissions:**

- Admin: full access, can manage team, billing, pipeline stages, automations
- Manager: can see all leads, all reps’ activities, run reports, assign leads
- Sales Rep: can only see their assigned leads, log activities, create estimates

### Notification System

**In-app notifications (bell icon in top nav, glass dropdown):**

- New lead assigned to you
- Lead status changed (if you’re watching it)
- Task due soon / overdue
- Estimate viewed by customer
- Estimate accepted/declined
- Storm alert in your service area
- New storm leads generated (with count)
- Team member mentioned you in a note

**Notification dropdown (glass panel):**

- Slides down from bell icon
- Shows unread count badge (red dot with count)
- Each notification: icon + message + relative timestamp + unread indicator
- Click to navigate to the relevant lead/task/storm
- “Mark all as read” link
- Glass styling consistent with the rest

**Email notifications (configurable per user):**

- Toggle which notification types trigger emails
- Digest option: immediate, hourly, daily summary
- Storm alerts: always immediate (can’t disable)

**Push notifications (for mobile companion — future):**

- Web Push API registration
- Service worker for background notifications

### Settings:

- Profile: name, email, phone, avatar upload
- Notifications: toggle each type on/off, set digest frequency
- Display: dark/light mode toggle, default view (kanban/list)

### Database:

New table: `notifications`

- id (UUID)
- tenant_id, user_id (FK)
- type (enum matching notification types above)
- title, body (text)
- reference_type (enum: ‘lead’, ‘task’, ‘estimate’, ‘storm_event’)
- reference_id (UUID)
- is_read (boolean)
- read_at (timestamptz)
- created_at (timestamptz)

Index on (user_id, is_read, created_at DESC)

New table: `notification_preferences`

- user_id (FK)
- notification_type (enum)
- in_app (boolean, default true)
- email (boolean, default true)
- push (boolean, default false)
- email_digest (enum: ‘immediate’, ‘hourly’, ‘daily’)

API routes:

- GET /api/notifications — paginated, filterable by is_read
- PATCH /api/notifications/:id/read — mark as read
- POST /api/notifications/mark-all-read
- GET /api/notifications/preferences — get user preferences
- PATCH /api/notifications/preferences — update preferences
- GET /api/notifications/unread-count — for badge

Use server-sent events (SSE) or WebSocket for real-time notification delivery to the frontend. When a notification is created server-side, push it to the user’s active connections immediately.

```
---

## PROMPT 10: Global Layout, Navigation & Sidebar
```

Build the global application layout, navigation sidebar, and top bar for StormLeads. This wraps all pages and provides consistent navigation.

### Design — Liquid Glass Shell

The app shell itself should feel like a floating glass interface:

**Background (behind everything):**

```css
.app-background {
position: fixed;
inset: 0;
background:
radial-gradient(ellipse at 20% 50%, oklch(0.20 0.06 250) 0%, transparent 50%),
radial-gradient(ellipse at 80% 20%, oklch(0.18 0.05 200) 0%, transparent 40%),
radial-gradient(ellipse at 50% 80%, oklch(0.16 0.04 280) 0%, transparent 45%),
oklch(0.12 0.02 260);
z-index: -1;
}
```

This creates a rich, deep dark background with colored light pools that the glass panels blur beautifully over.

**Sidebar (left, 260px wide):**

- Glass panel with heavier blur (40px)
- Background: oklch(0.14 0.015 250 / 0.7)
- Collapsible to icon-only mode (64px) on smaller screens or user preference
- Smooth width transition with cubic-bezier

**Sidebar content (top to bottom):**

1. Tenant logo + company name (or icon in collapsed mode)
1. Navigation links:
- 🏠 Dashboard
- 📊 Pipeline (Kanban)
- 📋 Leads (List view)
- 🗺️ Storm Map
- 📅 Calendar (future)
- ✅ Tasks
- 💰 Estimates
- 📄 Documents
- 📈 Reports
- ⚙️ Settings
1. Divider
1. Recent leads section (last 5 viewed — quick access)
1. Bottom: user avatar + name + role, logout button

**Nav link styling:**

- Glass pill button, full width
- Active: filled with oklch primary at low opacity, left border accent
- Hover: subtle background change
- Icon + label (label hidden in collapsed mode)
- Tooltip on hover when collapsed

**Top bar (sticky, full width minus sidebar):**

- Glass panel, height 64px
- Background: oklch(0.14 0.015 250 / 0.5) with blur
- Left: breadcrumb navigation (Dashboard > Pipeline > Lead Detail)
- Center: global search input (glass styled, searches across leads, contacts, addresses)
- Right: notification bell (with unread badge) + user menu dropdown

**Global search:**

- Command-K shortcut to focus
- As-you-type search results dropdown (glass panel)
- Shows results grouped: Leads, Contacts, Addresses, Storm Events
- Each result shows relevant icon + primary info + secondary info
- Click to navigate, Escape to close
- Debounced API call: GET /api/search?q=…

**Mobile navigation:**

- Sidebar becomes a hamburger menu slide-over
- Top bar stays but simplified
- Bottom tab bar for primary nav: Dashboard, Pipeline, Leads, Map, More

### Layout structure:

```jsx
<AppShell>
<AppBackground />
<Sidebar collapsed={isCollapsed}>
<Logo />
<NavLinks />
<RecentLeads />
<UserMenu />
</Sidebar>
<MainContent>
<TopBar>
<Breadcrumbs />
<GlobalSearch />
<NotificationBell />
<UserAvatar />
</TopBar>
<PageContent>
<Outlet /> {/* React Router */}
</PageContent>
</MainContent>
</AppShell>
```

Use React Router v6 with nested routes. Sidebar navigation should use NavLink with active class detection. Page transitions: subtle opacity fade between route changes.

The entire layout should be responsive and handle viewport changes smoothly. Use CSS Container Queries where appropriate for component-level responsiveness.

```
---

## Build Order for Claude Code

1. **Prompt 10** — Global layout, sidebar, navigation (the shell everything lives in)
2. **Prompt 1** — Database schema expansion (the data foundation)
3. **Prompt 2** — API endpoints (the backend logic)
4. **Prompt 3** — Kanban board (the primary CRM view)
5. **Prompt 5** — Lead list view (the power-user table view)
6. **Prompt 4** — Lead detail panel (the slide-over for individual leads)
7. **Prompt 7** — Activity logging (how interactions get recorded)
8. **Prompt 6** — Dashboard & analytics (the home screen with metrics)
9. **Prompt 8** — Estimate builder (proposal creation)
10. **Prompt 9** — Team management & notifications (admin + real-time updates)

### Notes for Claude Code:
- This builds ON TOP of the existing StormLeads Phase 1 codebase. Do not recreate existing tables or components.
- All new components must use the Liquid Glass design tokens defined in this document.
- All colors must be in oklch() — never hex, rgb, or hsl.
- Use React Query (TanStack Query) for all data fetching.
- Use React Router v6 for navigation.
- Use @dnd-kit for drag and drop.
- Backend uses Express.js with async/await and proper error handling.
- Database uses node-postgres (pg) with parameterized queries.
- Every API route must verify tenant_id from JWT — no cross-tenant data leakage.
- Test on dark backgrounds first — that's the default theme.