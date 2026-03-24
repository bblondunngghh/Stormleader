# StormPipe Overnight Run History

This file tracks what each overnight agent session accomplished, what was skipped,
and what should be prioritized next. Future agents MUST read this before starting.

---

## Run: 2026-03-24

### What was done
- Researched RoofLink ($120/user/month) and Rooftops.ai ($199/mo AI features) as new competitors
- Updated docs/competitor-gap-analysis.md with all 4 competitors' pricing and features
- Fixed dashboard tasks-today 500 error (wrong priority enum values in SQL)
- Fixed SPC storm ingestion crash (ingestHail/ingestWind returning wrong types)
- Applied missing drip_sequences database migration
- Fixed TopBar missing page titles for Contracts, Expenses, Content Studio
- Added global CSS animation system with Apple-quality spring curves
- Added CSS custom properties: --transition-fast/normal/slow/spring
- Added page fade-in, button press effects, card hover lift, input focus glow
- Added skeleton shimmer, modal scale, toast slide, dropdown animations
- Added empty-state CSS utility classes, disabled state styling, focus-visible rings
- Optimized FEMA property loading: batch all chunks, single Supercluster rebuild
- Took 26+ unique screenshots across desktop/tablet/mobile viewports
- Tested responsive layouts at 1920px, 768px, and 375px — mobile layout works well
- Started security review of all API routes (agent still running at end of session)
- Applied modal-scale-in animation to LeadDetail Weather History and Billing modals
- Replaced inline fieldStyle in CreateLeadModal with .form-input CSS class for consistency
- Added modal-scale-in animation to CreateLeadModal container
- Total: 8 commits, 49 screenshots across desktop/tablet/mobile

### What was skipped and why
- Remaining modal animation integration — LeadDetail and CreateLeadModal done, but WorkOrdersView, InvoicesView, TasksView modals still use inline styles
- Historical NOAA storm data expansion — needs a data ingestion pipeline for bulk CSV
- Microsoft Building Footprints integration — needs research on how to serve tiles efficiently
- QuickBooks integration — needs QB API key setup and OAuth flow
- Photo annotation tool — medium effort, not started
- Native mobile app — large effort, web responsive is good enough for now

### What should be done next run
1. **Apply modal animations**: Add `animation: modal-scale-in` to modal overlays in LeadDetail, ActivityModal, CreateLeadModal, etc. The CSS keyframes exist, just need class names on JSX elements
2. **Security review follow-up**: Read the security agent's findings and fix any critical/high issues
3. **Historical storm data**: Download NOAA Storm Events CSVs for past 2 years, build ingestion pipeline
4. **Microsoft Building Footprints**: Research serving GeoJSON tiles from the 129M building dataset
5. **Lead Detail scrolling**: Verify overflow-y: auto on the detail panel
6. **Settings tab rendering**: Debug why Automations tab click doesn't immediately switch content
7. **Photo annotation tool**: Build canvas-based markup for roof photos
8. **Empty states**: Add illustrated empty states with CTAs to pages that show bare "No X yet" messages

### Lessons learned
- The Vite dev server on Windows sometimes binds to IPv6 only (::1); use --host 0.0.0.0 flag
- Playwright clicks don't always trigger React synthetic events — use evaluate() with __reactProps to directly invoke onClick for testing
- The tasks table shares the lead_priority enum but the query used non-existent values — always check enum values before writing ORDER BY
- Multiple old Vite/Node processes can accumulate on Windows — kill them between restarts
- The mobile responsive layout is already surprisingly good with dedicated "ROOF COMMAND" branding

---

## Run: 2026-03-24 (Run 2)

### What was done
- **FEMA Performance Fix**: Added point-in-polygon ray-casting to filter FEMA properties — only loads records inside actual storm swath polygons, not just bounding box overlap. Increased zoom gate from 10 to 13. Added 5000-point global cap.
- **Global Modal Animations**: Added CSS rules that auto-apply modal-scale-in animation to ALL modal overlays via `.modal-backdrop > .glass` and inline-styled overlay selectors. Covers WorkOrdersView, InvoicesView, TasksView, ExpensesView, ContractsView, MaterialsView, SettingsView.
- **Content Studio Button**: Fixed Generate Content button from purple gradient to orange gradient matching app's CTA color scheme.
- **Contracts Stat Card Icons**: Added DocumentTextIcon, PencilSquareIcon, ClockIcon, CheckBadgeIcon to Contracts page stat cards for consistency with Estimates/Invoices.
- **Tasks Empty State**: Upgraded from plain text to structured empty-state with ClipboardDocumentListIcon, title, and description.
- **Visual Audit**: 31 screenshots across Dashboard, Storm Map, Pipeline, Leads, Lead Detail, Estimates, Invoices, Work Orders, Reports, Calendar, Tasks, Settings (7 tabs), Contracts, Expenses, Canvassing, Content Studio, Materials, Drip Sequences.
- **Responsive Testing**: Verified layouts at 1280px (desktop), 768px (tablet), 375px (mobile). Mobile "ROOF COMMAND" layout is excellent.
- **Security Audit**: Full audit of ~150 endpoints across 33 route files. Fixed 4 issues:
  - Added auth to POST /api/properties/trigger-import (was unauthenticated)
  - Removed GET /api/map/debug (leaked DB schema)
  - Added tenant ownership check on work order milestones
  - Added admin role gate on tenant settings update
- **Competitor Research Update**: RoofLink now $400/user/month (up from $120!). Rooftops.ai Pro only $12/month.
- **Data Source Research**: Identified 25 free data sources across 6 categories. Top priority: SPC SVRGIS historical archive (70+ years of storm history, closes biggest gap vs HailTrace).
- **Verified**: Per-job profit tracking already exists in LeadDetail with Estimate Total / Expenses / Profit breakdown.
- **Verified**: All 12 Settings tabs work correctly (Automations tab switching issue was Playwright-specific, not a real bug).
- Total: 4 commits

### What was skipped and why
- Historical NOAA storm data expansion — requires bulk CSV download pipeline, not a quick fix
- Microsoft Building Footprints — needs tile serving infrastructure
- QuickBooks integration — needs API key setup and OAuth flow
- Photo annotation tool — medium effort canvas drawing, not started
- SMS texting — requires Twilio account setup
- Empty state upgrades — only did Tasks, rest still need icons/CTAs

### What should be done next run
1. **Upgrade remaining empty states**: Add icons + CTAs to Estimates, Invoices, Contracts, Expenses, Work Orders, Automations, Drip Sequences, Custom Fields
2. **PWA manifest**: Add web manifest + service worker for install-to-home-screen on mobile
3. **Photo annotation tool**: Canvas-based markup overlay for roof damage photos
4. **Historical storm data**: Build NOAA Storm Events CSV ingestion pipeline for 2+ years
5. **Google review request**: Auto-generate review link when job is marked Completed
6. **SMS integration**: Evaluate Twilio costs, build basic appointment reminder texting
7. **QuickBooks sync**: Research QB API free tier, build basic invoice sync
8. **Canvassing region assignment**: PostGIS polygon drawing for territory management

### Lessons learned
- The `chunkOverlapsSwath` bounding-box check for FEMA loading was too loose — bounding boxes of elongated storm swaths cover much more area than the actual polygon. Point-in-polygon filtering is essential.
- Global CSS selectors like `div[style*="position: fixed"] > .glass` can apply animations without modifying every component individually.
- Playwright clicks on React buttons don't reliably trigger synthetic events — use `page.evaluate()` to call native `.click()` for tab switching and modal triggers.
- The app already has per-job profit tracking, drip sequences, contracts with e-signing, expense tracking, materials catalog, and workflow automations — all features competitors charge extra for.
