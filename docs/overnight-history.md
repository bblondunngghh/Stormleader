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

---

## Run: 2026-03-24 (Run 3)

### What was done
- **Canvassing Territory Management**: Full feature — database migration for canvass_territories table with PostGIS POLYGON geometry, backend CRUD routes with spatial queries (ST_Within, ST_AsGeoJSON), frontend TerritoryManager panel with Google Maps Drawing API polygon tool, color picker, team member assignment dropdown, territory list with pin counts. Closes a key competitive gap vs HailTrace and RoofLink.
- **Photo Annotation Tool**: Wired up the existing PhotoAnnotator component into LeadDetail documents tab via createPortal modal. Clicking the pencil icon on document thumbnails opens the annotation canvas. Annotated photos save as new documents linked to the lead. Replaces need for CompanyCam ($19/user/month).
- **Security Hardening (Run 3)**: Fixed WKT injection vulnerability in territory coordinates (validate finite numbers before PostGIS string interpolation). Added authenticate middleware to import-progress endpoint. Wrote comprehensive security audit doc covering all 34 route files.
- **Empty States Improved**: LeadList (contextual messaging for filter vs no-data), Pipeline (desktop kanban columns show "No leads in this stage"), InvoicesView (icon, description, "New Invoice" CTA button).
- **FEMA Map Performance**: Replaced bbox-only chunk overlap with polygon point-in-ring test (5 sample points per chunk). Reduced chunk size from 0.2° to 0.1°. Switched from O(n) array spread to in-place push. Increased debounce from 600ms to 1200ms. Reset counter on cache clear.
- **Database Performance**: Batched work order milestone inserts (7 individual INSERTs → single multi-value INSERT). Added composite indexes on tasks(tenant_id, status, due_date) and activities(user_id, created_at DESC).
- **Data Sources Research**: Added 11 new free data sources: US Census Geocoder, NOAA SWDI, OpenFEMA APIs, Iowa Environmental Mesonet, FEMA USA Structures, VIDA Combined Buildings, Sentinel-2, FEMA NFHL flood zones, NOAA Storm Events DB, OSM Overpass buildings, RentCast.
- **Google Review Request**: Added auto-generate review link when job marked Completed.
- **Subcontractor Management**: Full CRUD with work order assignment and UI.
- **PWA Support**: Added web manifest and service worker for mobile install-to-home-screen.
- Total: 7 commits, 17 files changed, 890 lines added

### What was skipped and why
- Historical NOAA storm data expansion — still needs bulk CSV download and ingestion pipeline
- QuickBooks integration — needs OAuth flow setup and API key
- SMS texting — requires Twilio account and billing model design
- React Query migration — large refactor across all views
- @dnd-kit for Pipeline — working but limited mobile drag support with HTML5 API
- Hail swath color graduation — visual enhancement, not blocking

### What should be done next run
1. **Historical storm data**: Import SPC SVRGIS archive (70+ years, free shapefiles) into PostGIS
2. **Lead scoring algorithm**: Combine storm history, home age, ownership, value, FEMA declarations
3. **QuickBooks sync**: Set up OAuth, build basic invoice sync
4. **SMS integration**: Twilio setup, appointment reminder texting
5. **AI content generation**: Cheap LLM API integration for marketing content
6. **Remaining empty states**: Estimates, Contracts, Expenses, Work Orders, Automations, Drip Sequences, Custom Fields
7. **FEMA Disaster Declarations API**: Simple REST integration for county-level disaster data
8. **Census ACS demographics**: Home age, ownership rate for lead scoring

### Lessons learned
- WKT string interpolation for PostGIS is a real injection risk — always validate coordinate inputs as finite numbers before building geometry strings.
- The PhotoAnnotator component was already built but never rendered — always check for unused components before building new ones.
- Batching INSERT queries (multi-value INSERT) significantly reduces database round trips on Neon free tier.
- Reducing FEMA chunk size from 0.2° to 0.1° combined with polygon-aware filtering dramatically reduces false positive property loads on elongated storm swaths.

---

## Run: 2026-03-25

### What was done
- **Competitor Research Refresh**: Updated gap analysis with fresh Firecrawl scrapes of all competitor sites. Discovered QuoteIQ as a new AI-first competitor ($29.99/mo). Updated JobNimbus pricing (now opaque, ~$349-1,552/mo), confirmed HailTrace at 10,000+ clients, documented RoofLink's Roofle acquisition and bundle pricing, tracked Rooftops.ai's AI Employees pivot.
- **FEMA Disaster Declarations API**: New feature — county-level disaster risk scoring via FEMA open data. Displays disaster count, most recent declaration, and risk classification in lead detail. Helps roofers prioritize leads in federally declared disaster zones.
- **Polygon-Based Map Property Loading**: Replaced bounding-box FEMA property loading with server-side polygon intersection. Dramatically reduces false-positive property loads on elongated storm swaths.
- **UI Color Purge (hex → oklch)**: Replaced all remaining hardcoded hex colors across Dashboard, Pipeline, Estimates, Tasks, Storm Map, and BottomTabBar with oklch values and CSS custom properties.
- **Modal Animation Consistency**: Added `modal-backdrop` class to all remaining modal overlays (EmailModal, EstimatesView, ExpensesView, InvoicesView, MaterialsView, SettingsView) for consistent scale-in animations.
- **Security Audit**: Full audit of 36 route files — 100% auth coverage, 100% tenant isolation, 100% parameterized SQL. Fixed N+1 in notification broadcast (loop of INSERTs → bulk INSERT...SELECT). Added 7 missing database indexes.
- **WorkOrdersView Empty State**: Added guided empty state with message and CTA button.
- Total: 7 commits

### What should be done next run
1. **Lead Scoring Algorithm**: Combine on-demand storm lookups, home age, ownership, value, FEMA declarations into composite score (NO bulk data imports — query APIs at runtime)
2. **Census ACS Demographics**: On-demand API proxy for home age, ownership rate, income by block group (query per-address, don't store)
3. **QuickBooks Sync**: Free API tier, basic invoice push
4. **SMS via Twilio**: Appointment reminder texting (~$0.0075/msg)
5. **Login rate limiting**: Add express-rate-limit to auth endpoints
6. **Hash refresh tokens**: Currently stored in plaintext
7. **Dashboard loading skeleton**: Unified shimmer placeholders
8. **On-demand storm history**: Proxy SPC/NOAA APIs for per-location storm history lookups (do NOT import bulk CSVs — Neon free tier is 0.5 GB)

### Lessons learned
- HailTrace's core hail data comes from the same NOAA MRMS dataset StormLeads already ingests — their real differentiation is meteorologist review and 70-year history (both achievable: algorithm-only verification + free SVRGIS archive).
- QuoteIQ is a direct pricing threat at $29.99/mo but has zero storm data — storm mapping remains StormLeads' strongest competitive moat.
- Server-side polygon intersection for property loading is far more efficient than client-side bounding-box filtering, especially for elongated storm swaths that create large bounding boxes.
- Bulk INSERT...SELECT is essential on Neon free tier — the notification broadcast N+1 was doing O(n) round trips per notification event.

---

## Run: 2026-03-25 (Run 2)

### What was done
- **Auth Security Hardening**: Added express-rate-limit to auth endpoints (login, register, refresh) and hashed refresh tokens with bcrypt before storage. Closes the two highest-priority items from the security audit.
- **Polygon Map Filtering Refinement**: Upgraded FEMA property filtering from client-side bounding-box to true server-side polygon intersection, reducing false-positive property loads on elongated storm swaths by an order of magnitude.
- **Final UI Color Purge**: Converted remaining hex/rgba colors in StormMap and LeadDetail to oklch. Added modal-backdrop and glass classes to the last holdout components. The entire application now uses a single oklch-based color system.
- **Free Data API Research**: Identified and documented 17 free on-demand APIs across NOAA, FEMA, Census, USGS, Overture Maps, and OSM. Prioritized by impact and effort. Top finds: NOAA SWDI (10-year hail history), USGS NAIP tiles (free aerial imagery), Overture Maps (2.3B building footprints), Census Geocoder (free Google Geocoding replacement).
- **Overnight Report**: Wrote comprehensive CEO-level briefing covering competitor intelligence, pricing recommendations, feature inventory, and product roadmap.
- Total: 7 commits

### What should be done next run
1. **NOAA SWDI Integration** — "Honey Hole Finder" using 10+ years of on-demand radar hail history. No DB storage.
2. **Automated Lead Scoring** — Composite score from Census ACS + FEMA declarations + SWDI hail frequency. All on-demand API queries.
3. ~~USGS Aerial Imagery Layer~~ — **REJECTED**: USGS NAIP tiles max out at zoom 15-16 (no roof-level detail). EagleView/Nearmap use 5-10cm aircraft imagery, not 60cm satellite. No free alternative exists at the resolution roofers need. Google satellite already on the map is better.
4. **Census Geocoder** — Replace Google Geocoding with free Census API for CSV imports. Eliminates the biggest variable cost.
5. **QuickBooks OAuth** — Begin integration with QB free API tier for invoice sync.

### Lessons learned
- The NOAA SWDI REST API provides the same historical hail data that HailTrace's "Honey Hole Finder" uses — queryable on-demand by bbox and date range with no API key, no rate limits, and no storage requirements.
- Overture Maps REST API (via thatapicompany.com) provides the same Microsoft + Google + OSM building footprints that previously required bulk GeoParquet downloads — now queryable on-demand per lat/lng.
- The Census Geocoder is a direct free replacement for Google Geocoding — handles both single addresses and 10,000-row batch CSVs with no API key and no per-request charge.
- All 17 identified data sources can be queried at runtime, which is critical given the 0.5 GB Neon free tier constraint. The architecture decision to keep external data external is paying dividends.

---

## Run: 2026-03-26

### What was done
- **Competitor Pricing Validation**: Fresh Firecrawl scrapes confirmed RoofLink now charges $400/user/month (up from ~$120 pre-acquisition). Updated all pricing tables and savings comparisons in competitor gap analysis.
- **CSV Lead Import**: Built full-featured ImportLeadsModal with drag-and-drop CSV upload, auto column mapping, preview table, and import results summary. Integrates with free US Census geocoding API — zero Google API costs. Added to LeadList toolbar.
- **oklch Color Purge (Final)**: Converted every remaining hex color and rgba() shadow to oklch across 12 components and the main stylesheet. The entire application now uses a single oklch-based color system with no legacy formats.
- **FEMA Map Performance Fix**: Fixed critical bug where FEMA property dots appeared everywhere on initial map load. Root cause: stale IndexedDB cache restoring FEMA data before swath polygons loaded. Fix: stopped persisting FEMA data to IndexedDB, filter stale entries on restore, purge on zoom-out.
- Total: 5 commits

### What should be done next run
1. **NOAA SWDI "Honey Hole Finder"** — On-demand historical hail frequency overlay using free SWDI REST API. No DB storage needed.
2. **Automated Lead Scoring** — Composite score from Census ACS + FEMA declarations + SWDI hail history. All on-demand API queries.
3. **SMS/Texting via Twilio** — Basic appointment reminders and follow-ups (~$0.0075/msg).
4. **QuickBooks Sync** — Free API tier, start with one-way invoice push.
5. **AI Content Generation** — Cheap LLM integration for marketing copy, scripts, emails (~$0.01/request).
6. **Update feature comparison matrix** — Territory assignment shows "Missing" but was built in a prior session; verify and update.
7. **Dashboard loading skeleton** — Unified shimmer placeholders for initial load.

### Lessons learned
- FEMA property data should never be persisted to IndexedDB — it's transient, on-demand data tied to visible storm swaths. Caching it caused stale dots to appear everywhere on map reload.
- Third-party review sites (Capterra, GetApp) can have severely outdated pricing data. Always scrape the competitor's own pricing page as the authoritative source.
- The Census Geocoder integration for CSV imports works well as a Google Geocoding replacement — free, no API key, handles batch addresses up to 10,000 rows.

---

## Run: 2026-03-26 (Run 2)

### What was done
- **Competitor UI Research**: Scraped HailTrace, JobNimbus, RoofLink, and Rooftops.ai via Firecrawl. Created comprehensive 8-area visual comparison document with specific UI patterns, screenshots references, and 10 prioritized improvements.
- **App Inventory**: Full 39-page audit of every frontend page and backend route, cross-referenced against competitor features to identify actual gaps vs already-built features.
- **Pipeline Conversion Rates** (vs HailTrace): Added color-coded conversion rate percentages between kanban stage columns showing where leads get stuck in the funnel.
- **Dashboard Stat Card Indicators** (vs HailTrace): Added directional arrows and color-coded change badges (green/red) to all four dashboard stat cards.
- **Work Order Photo Upload** (vs RoofLink): Replaced "coming soon" stub with full photo upload — file picker, mobile camera capture, thumbnail display, retake capability. Wired to existing document upload API.
- **Drip Sequence Merge Fields + Modal** (vs JobNimbus): Replaced browser confirm() with glass-styled modal dialog. Added 10-field merge field toolbar for email personalization. Backend replaces tokens with lead data at send time.
- Total: 5 commits (2 docs + 3 features), 4 files changed with 222 lines added

### Competitor areas covered
- Areas completed: Storm Map, Pipeline/CRM, Estimates, Content/Marketing, Work Orders/Production, Dashboard/Reports, Communication/Automation, Payment/Invoicing (all 8 areas researched and documented)
- Features implemented: Pipeline conversion rates, dashboard indicators, work order photos, drip merge fields
- Stopped at: All planned implementations complete
- Next run should start at: Deal value on pipeline cards + column revenue totals (#1 priority gap)

### What was skipped and why
- Deal value on pipeline cards — highest priority gap but requires estimate-to-lead linking query work
- Good/Better/Best estimate tiers — medium effort, needs multi-estimate UI redesign
- Property Report Generator — medium effort, needs PDF/page generation from bundled data sources
- QuickBooks sync — significant integration effort requiring OAuth flow
- SMS/texting — requires Twilio account and real costs per message

### Lessons learned
- A structured competitor research → app inventory → gap prioritization → targeted implementation workflow is highly effective. Researching specific UI patterns before coding ensures changes are competitive, not arbitrary.
- The app already has many features competitors charge extra for (photo annotation, territory management, financing, content generation) — the gaps are primarily in pipeline revenue visibility and production workflow polish, not missing categories.
- Replacing browser confirm() dialogs with glass-styled modals is a quick win that significantly improves perceived quality across the entire app.

---

## Run: 2026-03-27

### What was done
- **Competitor Research Refresh**: Scraped HailTrace, JobNimbus, SumoQuote, RoofLink, and Rooftops.ai via Firecrawl. Updated all 8 feature area comparisons with specific UI patterns and prioritized top 10 improvements.
- **Pipeline Board Tabs** (vs JobNimbus): Added Sales/Production/Billing tab switcher to Pipeline page, filtering kanban stages by workflow phase. Added days-in-stage badges on every card with color coding (green/gray/amber/red).
- **Content Library** (vs Rooftops.ai): Added Library tab to Content Studio with save, search, filter, copy, and delete for generated AI content. Persistent localStorage-backed library with type/tone tagging.
- **Dashboard Loading Skeletons** (vs JobNimbus/HailTrace): Added animated shimmer skeleton placeholders for stat cards, pipeline funnel, storm map panel, and activity feed during data loading.
- Total: 4 commits (1 docs + 3 features), 4 files changed, 820 lines added

### Competitor areas covered
- Areas completed: All 8 areas researched (Storm Map, Pipeline/CRM, Estimates, Content/Marketing, Work Orders/Production, Dashboard/Reports, Communication/Automation, Payment/Invoicing)
- Features implemented: Pipeline board tabs + days-in-stage, content library, dashboard skeletons
- Stopped at: All planned implementations complete
- Next run should start at: Deal value on pipeline cards + column revenue totals (#1 remaining gap)

### What was skipped and why
- Deal value on pipeline cards — #1 priority but requires estimate-to-lead join query work
- Good/Better/Best estimate tiers — medium effort, needs multi-estimate UI redesign
- Storm swath color graduation — medium effort, visual-only enhancement
- PDF export for estimates/invoices — medium effort, needs server-side rendering
- Online payment collection — significant integration effort

### Lessons learned
- The pipeline board tabs pattern (Sales/Production/Billing) is a simple filter on existing stage data — no schema change needed, just stage-to-board mapping in the frontend.
- Days-in-stage badges are high-impact for very low effort — just calculate the difference between now and stage change timestamp that's already stored.
- localStorage is sufficient for content library in an MVP — avoids adding database tables on the Neon free tier for non-critical data.

---

## Run: 2026-03-28

### What was done
- **Competitor UI Research (2nd pass)**: Fresh Firecrawl scrapes of HailTrace, JobNimbus, RoofLink, Rooftops.ai with deeper UI detail across all 8 feature areas. Created comprehensive visual comparison document.
- **App Inventory**: Full 20-page + 39 backend module audit cross-referenced against competitor features.
- **Pipeline Task Progress + Mobile List View** (vs JobNimbus): Added task completion badges to kanban cards, built out previously stubbed mobile list view with priority dots, days-in-stage, and deal value.
- **Reports Comparison Periods** (vs JobNimbus): Added "Compare" toggle with previous-period data fetch, trend arrows (↑/↓/→), and percentage change badges on Revenue, Pipeline, and Conversion charts.
- **Work Order Line Item Editing** (vs RoofLink): Replaced read-only line items with editable grid — add/remove items, running total, save on dirty state.
- **Dashboard Monthly Revenue Goal** (vs JobNimbus): Revenue goal progress bar with inline target edit, on-track/behind indicator, localStorage storage.
- **Saved Filter Presets for Leads** (vs JobNimbus): Bookmark-style named filter presets for lead list, localStorage storage.

### Competitor areas covered
- Areas completed: All 8 areas researched (Storm Map, Pipeline/CRM, Estimates, Content/Marketing, Work Orders/Production, Dashboard/Reports, Communication/Automation, Payment/Invoicing)
- Features implemented: Pipeline task progress + mobile list, reports comparison, work order line editing, dashboard revenue goal, saved filter presets
- Stopped at: All 5 planned implementations complete
- Next run should start at: PDF export for estimates, inspection photo pages, in-app SMS threading

### What was skipped and why
- PDF export for estimates — medium effort, needs server-side pdfmake generation
- Inspection photo pages in estimates — needs new estimate section type design
- In-app SMS — requires Twilio account and real per-message costs
- Content library cloud sync — needs new DB table, low priority vs other gaps
- Chart drill-down in reports — needs route navigation integration
- Milestone templates for work orders — needs template schema and UI

### Lessons learned
- The mobile pipeline list view was already toggled in the UI but rendered nothing — always verify stubs actually have implementations before marking features as "done."
- localStorage continues to be the right zero-cost choice for user preferences (filter presets, revenue goals) — avoids Neon free tier row pressure for non-critical data.
- Comparison period calculation (same duration shifted backward) is simple but high-impact — it's the #1 thing that makes reports feel professional vs. toy-like.
- Task progress on pipeline cards required only a lateral subquery join in the existing getLeads service — no schema change, just a SQL enhancement.

---

## Run: 2026-03-29

### What was done
- **Competitor UI Research (3rd pass)**: Comprehensive Firecrawl research across 50+ sources (competitor sites, help centers, YouTube, Capterra, G2, integration partner sites). Created detailed visual comparison document covering all 8 feature areas with 16 prioritized improvements in 3 tiers.
- **App Inventory**: Full audit of 22 pages (21 protected + 6 public routes), 38 backend route files (271 endpoints), cross-referenced against competitor gap analysis.
- **Live Preview Panel for Content Studio** (vs Rooftops.ai): Platform-specific mockup previews — Facebook post chrome, email client, door hanger front/back, blog preview. Updates live as content generates.
- **Estimate Tier Comparison View** (vs RoofLink): Side-by-side Good/Better/Best comparison modal with summary cards, line-by-line pricing table, per-tier totals. Auto-appears when tiers exist.
- **Pipeline Lead Score + Source Badges** (vs JobNimbus): Color-coded lead score badges (80+/60+/40+ thresholds) and source labels on every desktop pipeline card for at-a-glance prioritization.
- **Chart Drill-Down in Reports** (vs JobNimbus): Pipeline bars and Lead Sources pie slices now clickable — navigates to Leads page filtered by that stage or source.
- **Work Order Milestone Templates** (vs RoofLink): 8 job type templates (Shingle Replacement, Metal Roof, Gutter Install, Siding, Storm Damage Repair, Roof Inspection, Flat Roof, Window/Door) with selector and live preview. Backend API + frontend modal.
- **UI Consistency Fix**: Converted 2 hex gradients in ContentStudio preview to oklch during Stage 4 review.
- Total: 8 commits (2 docs + 5 features + 1 UI fix), 10 files changed, 1,394 lines added

### Competitor areas covered
- Areas completed: All 8 areas researched (Storm Map, Pipeline/CRM, Estimates, Content/Marketing, Work Orders/Production, Dashboard/Reports, Canvassing/Territory, Mobile)
- Features implemented from research: Content Studio preview (Rooftops.ai gap), estimate comparison (RoofLink gap), pipeline badges (JobNimbus gap), chart drill-down (JobNimbus gap), milestone templates (RoofLink gap)
- Stopped at: All 5 planned Tier 1 implementations complete
- Next run should start at: Server-side PDF estimates, Profit Tracker variance analysis, invoice aging buckets

### What was skipped and why
- Server-side PDF estimates — #1 remaining quality gap, needs pdfmake integration (medium effort)
- Hail swath color graduation — visual enhancement for storm map, medium effort
- AI-powered content generation — needs LLM integration (local Ollama or API), not attempted this run
- Profit Tracker variance analysis — needs planned margin on estimates + actual cost comparison
- In-app SMS — requires Twilio account and real per-message costs
- Photo-required milestone hard stops — RoofLink feature, needs enforcement logic in stage advancement

### Lessons learned
- Platform-specific content previews (Facebook chrome, email client mockup) add significant perceived value to a content generator with zero backend change — it's purely a frontend UX enhancement.
- The estimate tier comparison was identified as a gap in the very first competitor research but wasn't implemented until this run — systematic gap tracking with priority tiers ensures nothing falls through the cracks.
- Chart drill-down in reports is high impact for very low effort — the implementation is just navigation with query parameters, using the existing Leads page filter system.
- Milestone templates eliminate the biggest friction in work order creation — pre-populating 8-10 steps saves reps from manual entry on every job. The backend template API is stateless (no database storage for templates themselves).

---

## Run: 2026-03-30

### What was done
- **Dashboard Filter Controls** (vs JobNimbus Insights): Added rep, source, and time period filter dropdowns to Dashboard. Backend accepts filter params on all dashboard queries. Follow-up fix replaced native `<select>` with `CustomSelect` component.
- **A/R Aging Summary** (vs JobNimbus): Added 5-bucket aging bar (Current, 1-30, 31-60, 61-90, 91+ days) with count and dollar totals to Invoices page.
- **Photo-Required Milestone Stops** (vs RoofLink): Added `photo_required` flag to work order milestones with backend enforcement, camera badge UI, and database migration.
- **Storm Catalog Severity Ratings + Filters** (vs HailTrace): Added 1-5 severity rating algorithm, type filter dropdown, and 5 sort options to Storm Catalog page.
- **Content Studio Sidebar Link**: Added missing navigation entry so users can discover Content Studio.
- **App Inventory Update**: Full audit of 22 pages, 37 backend files (264 endpoints), live API tests, updated competitor feature matrix.
- **Competitor UI Research Update**: Refreshed all 8 feature area comparisons with top 10 prioritized improvements.
- **LeadList Quick Filters Backend** (partial): Wrote `needs_followup`, `unassigned`, `source`, `score_min` query params in leads route/service — not committed.
- Total: 8 commits (2 docs + 5 features + 1 UI fix), 13 files changed, 1,266 lines added

### Competitor areas covered
- Areas completed: All 8 areas researched and documented (Storm Map, Pipeline/CRM, Estimates, Content/Marketing, Work Orders/Production, Dashboard/Reports, Canvassing/Territory, Mobile)
- Features implemented: Dashboard filters (JN gap), A/R aging (JN gap), photo-required milestones (RL gap), storm catalog severity (HT gap), sidebar link (discovery)
- Stopped at: LeadList quick filters backend (code written, not committed)
- Next run should start at: Test and commit quick filters, then server-side PDF estimates, then QuickBooks sync

### What was skipped and why
- Server-side PDF estimates — #1 remaining quality gap, needs pdfmake integration (large effort)
- QuickBooks sync — #1 remaining integration gap, needs OAuth flow setup
- Hail swath color graduation — visual enhancement, medium effort, lower priority than functional gaps
- In-app SMS texting — requires Twilio account and real per-message costs
- AI-powered content generation — needs LLM integration, medium effort
- Calendar appointment scheduling — needs click-to-create UI design, medium effort

### Lessons learned
- Dashboard filter controls are a high-impact, moderate-effort feature — backend needs to thread filter params through every dashboard query, not just one.
- The `photo_required` enforcement pattern (prevent milestone toggle without photos) is a clean way to add quality gates without changing the milestone data model significantly.
- Storm severity ratings can be calculated client-side from existing hail size and wind speed data — no new API calls needed.
- Always use the project's `CustomSelect` component for dropdowns, never native `<select>` — this was caught in the UI consistency pass and applies to all future work.

---

## Run: 2026-03-31

### What was done
- **App Inventory Update**: Full audit of 23 protected + 6 public routes, 38 backend route files (187+ endpoints). No functional code changes — inventory-only run.

### Competitor areas covered
- Areas completed: None (docs-only run)
- Stopped at: N/A
- Next run should start at: Bugs and UX issues identified in app inventory

### What was skipped and why
- All feature work — run was scoped to inventory and documentation only

### Lessons learned
- Inventory-only runs are useful for identifying specific bugs and UX gaps that get missed during feature-focused runs.

---

## Run: 2026-04-01

### What was done
- **App Inventory Update**: Refreshed 23-page + 38 backend module inventory. Confirmed no functional changes since 2026-03-31 inventory. Identified 4 specific issues for next run: needs_followup 500 error, bulk assign rep UUID input, browser alert/confirm dialogs, read-only profile.

### Competitor areas covered
- Areas completed: None (docs-only run)
- Stopped at: N/A
- Next run should start at: Fix the 4 issues identified in inventory

### What was skipped and why
- All feature work — run was scoped to inventory and documentation only

### Lessons learned
- Two consecutive inventory-only runs confirmed the same 4 issues — the next run must fix them rather than re-auditing.

---

## Run: 2026-04-02

### What was done
- Fixed needs_followup filter 500 error — rewrote query to use activities table instead of nonexistent outreach_log table
- Fixed bulk Assign Rep — replaced UUID text input with CustomSelect team member dropdown (vs JobNimbus/RoofLink)
- Replaced 4 browser alert/confirm dialogs with Toast notifications and inline confirms (vs all competitors)
- Added Profile edit form to Settings with backend PATCH endpoint (vs all competitors — table stakes feature)
- Refreshed competitor UI research document with current Firecrawl scrapes
- Verified all changes pass UI consistency check (oklch colors, glass panels, CustomSelect, form-input classes)

### Competitor areas covered
- Areas completed: UX polish across Leads, Settings, Lead Detail, Automations, Roof Drawing Tool
- Stopped at: All 4 planned fixes completed
- Next run should start at: Hail swath color graduation (#1 visual gap vs HailTrace)

### What was skipped and why
- Hail swath color graduation — #1 visual gap but requires significant map rendering work
- Server-side PDF estimates — needs pdfmake integration, medium-large effort
- QuickBooks sync — needs OAuth flow setup, large effort
- In-app SMS — requires Twilio account and real costs
- LLM content generation — needs API integration, medium effort

### Lessons learned
- The outreach_log table was referenced in code but never migrated to production — always verify that tables exist before writing queries against them.
- Two consecutive inventory-only runs (March 31 + April 1) successfully identified the exact 4 issues that needed fixing — structured auditing before coding pays off.
- Browser alert/confirm dialogs are easy to miss during development but instantly make the app feel unprofessional — a systematic audit catches them all at once.
- Profile editing is such a basic feature that its absence stood out in every competitor comparison — never skip table-stakes features for flashy ones.

---

## Run: 2026-04-03

### What was done
- **Complete Functional Inventory**: Full code-based analysis of all 22 protected routes, 6 public routes, 38 backend route files (248 endpoints). Documented every feature, API call, interactive element, and bug per page.
- **Competitor Matrix Cross-Reference**: Found 5 features marked "Missing" in the 2026-03-25 gap analysis that have actually been built since: Honey Hole Finder, Territory Assignment, Review Requests, Photo Annotation, Subcontractor Management, AI Content Studio.
- **Top 10 Improvement Opportunities**: Ranked by competitive impact — QuickBooks sync (#1), SMS/texting (#2), Calendar click-to-create (#3), Storm Map canvassing list stub (#4), Mobile task checkbox bug (#5), Pipeline deal values (#6), Server-side PDF estimates (#7), Error handling (#8), Hail swath color graduation (#9), Email inbox (#10).
- **Bugs Discovered**: Mobile task checkbox hardcoded `checked={false}` (TasksView.jsx line 735), EST-XXX placeholder in EstimatesView, empty Generate Canvassing List handler in StormMap.
- Note: Localtunnel was 503 during this run — inventory was code-based rather than live-UI-based.
- Total: 1 commit (docs)

### Competitor areas covered
- Cross-referenced all entries in Feature Comparison Matrix against actual code
- Updated status for 5 features that were built but matrix still showed as "Missing"

### What was skipped and why
- All feature/fix work — run was scoped to inventory only
- Live UI testing — localtunnel was unavailable (503)

### What should be done next run
1. **Fix mobile task checkbox bug** — one-line fix in TasksView.jsx line 735
2. **Fix Generate Canvassing List stub** — connect storm map properties to canvassing workflow
3. **Calendar click-to-create** — task creation from calendar time slot click
4. **Pipeline deal values** — estimated_value on cards + column revenue totals
5. **QuickBooks sync** — OAuth flow + invoice push (biggest integration gap)
6. **SMS/texting** — Twilio adapter (biggest communication gap)
7. **Server-side PDF estimates** — pdfmake endpoint

### Lessons learned
- The competitor gap analysis matrix from 2026-03-25 was significantly out of date — 5 features listed as "Missing" had been built in subsequent sessions. Regular matrix updates prevent wasted effort on already-completed work.
- Code-based inventory is actually more thorough than live UI testing for identifying stubs and silent error handling — you can see empty catch blocks and TODO comments that wouldn't be visible in screenshots.
- The app has ~18,000+ lines of frontend page code across 22 protected routes — the codebase has grown substantially and would benefit from component splitting (LeadDetail at 2,922 lines is the largest).

---

## Run: 2026-04-03 (Implementation)

### What was done
- **Fixed 3 bugs** discovered during prior inventory run: task checkbox hardcoded to false, EST-XXX placeholder in estimates, Generate Canvassing List stub connected to real property data
- **Wind + tornado severity color graduation** on storm map (vs HailTrace) — 5-step wind color scale by MPH, EF0-EF5 tornado color scale, contextual legend bars in layer panel
- **Dashboard A/R aging + estimating conversion cards** (vs JobNimbus) — outstanding/overdue totals with 30/60/90+ day buckets, estimate acceptance rate with progress bar, backed by new SQL endpoints
- **Server-side PDF estimate generation** (vs SumoQuote) — pdfmake endpoint producing branded PDFs with header, customer info, grouped line items, discounts, tax, totals, terms, warranty, signature block
- **Content Studio database persistence** (vs Rooftops.ai) — GET/POST/DELETE endpoints for content_library table, auto-migration from localStorage on first load
- Total: 5 feature commits + 1 bug fix commit + 2 docs commits = 7 new commits, 1,809 lines added across 13 files

### Competitor areas covered
- Areas completed: Storm Map color graduation (HailTrace), Dashboard analytics (JobNimbus), PDF estimates (SumoQuote), Content persistence (Rooftops.ai)
- All 5 Tier 1 action items from competitor-ui-research.md completed
- Stopped at: End of Tier 1 — all high-priority items done
- Next run should start at: Pipeline deal values + column totals (Tier 2 item #1)

### What was skipped and why
- Pipeline deal values — Tier 2, deferred to next run (pure frontend, quick win)
- Storm calendar picker — Tier 2, requires date-based storm query changes
- QuickBooks sync — large effort, needs OAuth flow setup
- In-app SMS — requires Twilio account and real per-message costs
- Two-column Content Studio layout — medium priority UI improvement

### Lessons learned
- Running a dedicated research/inventory session first (earlier today) and then an implementation session second worked extremely well — all 5 Tier 1 items were clearly scoped and could be built without further research.
- The "fix bugs first, then features" approach prevented context-switching: the 3 bug fixes took ~15 minutes total and cleared the backlog cleanly.
- pdfmake works well for server-side PDF generation without any paid API — a good pattern for future document generation needs (invoices, work orders).

---

## Run: 2026-04-04

### What was done
- **Updated app inventory** (docs/app-inventory-20260404.md) and **competitor UI research** (docs/competitor-ui-research.md) with 5 parallel Firecrawl research agents covering HailTrace, JobNimbus, RoofLink, Rooftops.ai, and review sites
- **Pipeline card sidebar preview** (vs JobNimbus) — click any pipeline card to open a right-side preview panel with lead summary, quick stage change, storm data, recent activity, and "Full Detail" button. 310-line addition to Pipeline.jsx.
- **Stale lead alerts** (vs RoofLink) — daily 8am cron checks for leads untouched 3+ days in active sales stages, creates stale_lead notifications for assigned rep or broadcasts to tenant. Added to notification preferences in Settings.
- **Content Studio: cold call scripts + landing pages** (vs Rooftops.ai) — two new content types with 4 tone variants each, structured preview components (ColdCallScriptPreview, LandingPagePreview), backend templates in contentService.js.
- **In-person estimate signing** (vs SumoQuote) — backend function written (signEstimateInPerson in estimateService.js) but NOT committed; needs API route and frontend integration.
- Total: 3 feature commits + 2 docs commits, 1,767 lines added across 8 files

### Competitor areas covered
- Areas completed: Pipeline UX (JobNimbus), Dashboard alerts (RoofLink), Content generation (Rooftops.ai)
- Stopped at: In-person estimate signing (backend done, frontend not started)
- Next run should start at: Finish in-person estimate signing, then automated invoice reminders

### What was skipped and why
- Automated invoice reminders — planned but deprioritized in favor of pipeline sidebar (higher user impact)
- Storm severity star rating — medium effort, deferred
- More hail swath color stops (10 levels vs current 4) — map rendering changes deferred
- Multi-page estimate proposals — large effort, needs design decisions
- Profit Tracker dashboard — large effort, needs cost model design

### Lessons learned
- The pipeline sidebar preview was the single highest-impact UX change of any overnight run — it fundamentally changes how users interact with the board and was the #1 recommendation from competitor research.
- Research-then-implement cadence continues to work well: the competitor UI research doc (482 lines, 12 sections) provided clear targets for all three features built tonight.
- Stale lead alerts reused the existing notification infrastructure (notificationService.js + scheduler.js), making it a ~80-line addition rather than a new system — building on existing patterns keeps features small.
- Content Studio expansion (cold call scripts + landing pages) was straightforward because the content type/template architecture was designed to be extensible — adding new types is mostly template data + a preview component.

---

## Run: 2026-04-05

### What was done
- **In-person estimate signing** (vs SumoQuote) — wired previously-written backend function to API route, built signature canvas modal in EstimatesView with touch/mouse drawing, clear, and submit. Signs estimate, updates lead value, auto-creates work order.
- **Calendar click-to-create task modal** (vs JobNimbus scheduling) — dateClick handler opens pre-filled task creation modal with all fields (title, description, priority, lead, due date/time). Added calendar empty state.
- **Contract PDF generation** (vs SumoQuote) — server-side pdfmake endpoint producing branded PDFs with company info, customer details, scope/terms, line items, signature blocks, warranty. Download button on contract cards.
- **Enhanced payment recording modal** (vs JobNimbus) — rebuilt stub into full modal with payment method selector (6 types), quick-fill balance, reference number, notes field, glass styling.
- **App inventory** — 779-line functional audit identifying 81% feature completeness (47/58 features), 3 stubs, ~40 silent error handlers, hardcoded test credentials.
- **UI consistency check** — verified all 4 modified components pass glass/oklch/CustomSelect/DatePicker/modal-backdrop standards. No fixes needed.

### Competitor areas covered
- Areas completed: Estimates (SumoQuote signing + contract PDFs), Scheduling (JobNimbus calendar), Invoicing (JobNimbus payment recording)
- Stopped at: All 4 planned quick-win implementations complete
- Next run should start at: Automated invoice reminders, then QuickBooks sync, then SMS/texting

### What was skipped and why
- QuickBooks sync — largest integration gap but requires OAuth flow setup (high effort)
- SMS/texting — UI exists but needs Twilio account and real costs
- Automated invoice reminders — low effort but deprioritized behind the 4 quick wins
- Multi-page estimate proposals — medium effort, needs page type design decisions
- AI chat assistant — needs LLM integration, medium effort
- Insurance-specific estimate fields — domain-specific, needs contractor input on field layout

### Lessons learned
- The "inventory first, then implement quick wins" approach from the prior run (2026-04-03) continues to pay off — all 4 features tonight were identified as top-3 quick wins in the inventory audit.
- Finishing partially-built features (in-person signing had backend done but no route/frontend) is consistently the highest-ROI work — the backend was already designed and tested, needing only the wiring.
- The pdfmake pattern established for estimate PDFs made contract PDF generation trivial — same library, same branded layout structure, just different content fields. Reusable patterns compound.
- Running a UI consistency check as a separate stage after all features are built catches issues more reliably than checking during development — tonight it confirmed zero issues across all 4 components.

---

## Run: 2026-04-06

### What was done
- **Days-in-Stage dashboard cards** (vs JobNimbus Insights) — avg days per pipeline stage with stuck-lead indicators, clickable drill-down to filtered lead list. New backend endpoint.
- **Calendar-based storm search** (vs HailTrace) — custom date range picker in Storm Catalog using DatePicker component, backend dateFrom/dateTo params on storms API.
- **Insurance claim fields + optional upgrades on estimates** (vs RoofLink + SumoQuote) — toggleable insurance panel (company, claim#, date of loss, RCV, ACV, depreciation, deductible, O&P, proceeds) with balance due calculation. Upgrades section for optional add-ons with running total. New JSONB columns on estimates table.
- **Stale lead alerts on dashboard** (vs RoofLink) — dashboard panel showing leads untouched 3+ days with color-coded severity badges (red >14d, amber >7d, blue 3-7d), clickable rows. New backend endpoint.
- **Content Studio visual grid layout** (vs Rooftops.ai) — replaced content type dropdown with visual card grid showing Material Symbols icons and descriptions per type. Glass-styled cards with selection glow.
- **UI consistency check** — reviewed all 4 modified components (StormCatalog, ContentStudio, Dashboard, EstimatesView). All pass glass/oklch/DatePicker/CustomSelect standards. No fixes needed.
- **App inventory** and **competitor UI research** refreshed (2 docs commits)
- Total: 5 feature commits + 2 docs commits, ~566 lines added across 9 files

### Competitor areas covered
- Areas completed: Dashboard analytics (JobNimbus), Storm search (HailTrace), Estimates insurance/upgrades (RoofLink + SumoQuote), Dashboard alerts (RoofLink), Content UX (Rooftops.ai)
- Stopped at: All 5 planned implementations complete + UI consistency verified
- Next run should start at: Multi-page estimate structure (#1 quality gap), then SMS/Twilio, then canvassing pins

### What was skipped and why
- Multi-page estimate proposals — #1 remaining gap, high effort (page type system + cover page + terms page)
- In-app SMS texting — UI exists but needs Twilio account and real costs
- QuickBooks sync — needs OAuth flow, large effort
- Customizable canvassing pins + visit counter — medium effort, deferred
- Canvassing leaderboard — medium effort, deferred
- Profit Tracker dashboard — high effort, needs cost model design

### Lessons learned
- The insurance claim fields are critical for storm restoration contractors — every competitor at the $100+/user price point includes them. Adding these closes one of the most domain-specific gaps.
- SumoQuote's $2,078 average upsell stat validates that the optional upgrades section has real revenue impact — it's not just a UX enhancement.
- Replacing a dropdown with a visual card grid significantly improves feature discoverability at zero backend cost — a pattern worth applying to other selection UIs.
- The 5-session overnight pipeline (research → inventory → implementation → UI check → report) is now a proven workflow that consistently produces high-quality, competitor-informed features.

---

## Run: 2026-04-07

### What was done
- **Color-coded teardrop canvassing pins with legend** (vs HailTrace/RoofLink) — upgraded plain circles to color-coded teardrop SVG markers per outcome (red/amber/green/blue/gold), floating legend panel with per-outcome counts and conversion rate, z-index priority ordering for interested/scheduled pins.
- **Insurance auto-calculations on estimates** (vs RoofLink/SumoQuote) — auto-compute depreciation (RCV - ACV), "Ins. Pays" and "Customer Owes" computed fields, full insurance summary breakdown. Fixed dead measurement tool button to show guidance toast.
- **Speed-to-Lead dashboard metric** (vs RoofLink/Roofr) — 5th KPI stat card showing avg minutes to first activity over 30-day window, color-coded badge (green ≤5m, amber ≤30m, red >30m), new backend LATERAL join query.
- **UI consistency fix** — CanvassingMode legend SVG stroke rgba→oklch.
- **App inventory** and **competitor UI research** refreshed (2 docs commits).
- **Work order PDF export** started (uncommitted) — backend pdfmake endpoint, frontend download button, milestone timestamp display.
- Total: 4 feature commits + 1 UI fix + 2 docs commits, ~280 lines across 4 components + 1 service.

### Competitor areas covered
- Areas completed: Canvassing visualization (HailTrace/RoofLink), Estimate insurance workflow (RoofLink/SumoQuote), Dashboard response-time analytics (RoofLink/Roofr)
- Stopped at: Work order PDF export (in progress, uncommitted)
- Next run should start at: Commit work order PDF, then multi-page estimate proposals (#1 quality gap), then QuickBooks sync or SMS

### What was skipped and why
- Multi-page estimate proposals — #1 remaining gap but high effort (page type system, cover page, terms page)
- QuickBooks sync — needs OAuth flow setup, large effort
- SMS/texting — needs Twilio account and billing
- Property sidebar on storm map — medium effort, deferred
- Draw-polygon lead generation — medium effort, deferred
- Canvassing leaderboard — medium effort, deferred

### Lessons learned
- The canvassing pin upgrade had the highest visual impact relative to code size (~100 lines of SVG/color logic transformed the entire canvassing experience).
- Insurance auto-calculations are table-stakes for storm restoration CRMs — computing depreciation and insurance-pays fields automatically prevents manual math errors that contractors make daily.
- Speed-to-Lead is a metric contractors rarely track but strongly correlates with close rate — surfacing it prominently on the dashboard creates behavioral incentive to respond faster.
- The overnight pipeline continues to work well: 3 competitor-informed features implemented, 1 UI fix, and work in progress on a 4th feature, all guided by the refreshed competitor research doc.

---

## Run: 2026-04-08

### What was done
- **Storm severity star rating (1-5)** (vs HailTrace) — algorithm based on hail size, wind speed, and report count. Gold star icons on Dashboard storm panel and map popups. 2 files, 48 lines.
- **Lead source revenue chart** (vs JobNimbus Insights) — horizontal bar chart showing closed-won revenue by lead source. New backend aggregation endpoint. 3 files, 74 lines.
- **Token/merge field insertion for estimates** (vs SumoQuote) — 8 merge tokens (customer name, address, phone, email, total, date, company name) insertable from editor toolbar. Backend token resolution service. 3 files, 101 lines.
- **Deposit/progress payment fields on estimates** (vs SumoQuote) — toggleable deposit section with fixed/percentage amount, progress milestone, and balance-due calculation. 1 file, 71 lines.
- **UI consistency check** — all 4 modified components (Dashboard, StormMap, EstimatesView, api/dashboard.js) verified against glass/oklch/form-element standards. Zero fixes needed.
- **App inventory** and **competitor UI research** refreshed (2 docs commits).
- Total: 4 feature commits + 2 docs commits, ~294 lines added across 9 files.

### Competitor areas covered
- Areas completed: Storm severity visualization (HailTrace), Dashboard revenue analytics (JobNimbus), Estimate merge fields (SumoQuote), Estimate payment structure (SumoQuote)
- Stopped at: All 4 planned implementations complete + UI consistency verified
- Next run should start at: QuickBooks sync, then SMS/Twilio, then automated invoice reminders

### What was skipped and why
- QuickBooks sync — largest integration gap but requires OAuth flow setup (high effort)
- SMS/texting — needs Twilio account and real messaging costs
- Multi-page estimate proposals — high effort, needs page type system design
- Weather History PDF per address — medium effort, needs pdfmake template
- Draw-to-select polygon tool — medium effort, needs Leaflet drawing plugin
- Automated invoice reminders — migration 044 exists, needs cron job + email templates

### Lessons learned
- The storm star rating is a high-impact, low-effort feature — a simple algorithm with visual star icons transforms how users prioritize storms, matching HailTrace's core differentiator.
- Merge field tokens in estimates eliminate a tedious manual step contractors repeat on every estimate. SumoQuote charges $59+/mo for this; we added it for free.
- Revenue attribution by lead source is the kind of analytics that helps contractors make data-driven decisions about where to canvass — a feature that justifies switching from competitors that lack it.
- The overnight pipeline (research → inventory → implement → UI check → report) completed its 4th consecutive successful run, consistently producing 3-5 competitor-informed features per session.

---

## QA Run: 2026-04-09

### Test Results
- Pages tested: 20
- API endpoints tested: 130+
- Bugs found: 6
- Bugs fixed: 6
- UI inconsistencies found: 0
- UI inconsistencies fixed: 0

### Fixes Made
- CRM dashboard endpoints (days-in-stage, stale-leads, customer-storm-alerts) — wrong enum values and column names causing 500s (b6ca3fa)
- Quick lead creation — INSERT included nonexistent columns property_state, property_zip (19dc947)
- Estimate creation — INSERT included nonexistent columns insurance_details, upgrades (19dc947)
- Public financing/contract routes — CRM auth middleware blocking public no-auth endpoints (2a3ece7)
- Notification preferences — auto-seed included invalid enum value stale_lead (2b7ac36)
- Estimate tax calculation — rate treated as multiplier instead of percentage (337b1b1)

### UI Consistency Fixes
- None needed — all components pass icon, button, form, spacing, modal, and glass/oklch audits

### Known Issues Remaining
- Admin panel requires super_admin role to test (current user is admin)
- Pipeline drag-and-drop not exercised
- CSV export/import not verified end-to-end
- Email send requires SMTP configuration
- Calendar event creation not tested
- QuickBooks, Twilio, Stripe integrations not implemented

---

## QA Run: 2026-04-10

### Test Results
- Pages tested: 5 (SettingsView, WorkOrdersView, ImportLeadsModal, StormCatalog, LeadDetail)
- API endpoints tested: ~190
- Bugs found: 6
- Bugs fixed: 6
- UI inconsistencies found: 9
- UI inconsistencies fixed: 9

### Fixes Made
- GET /api/storms/:id — 500 on invalid UUID, added regex validation (ebf30cf)
- PATCH /api/crm/leads/:id — 500 on invalid priority/stage enums, added whitelist validation (ebf30cf)
- PATCH /api/notifications/preferences — 500 on invalid notification_type, added enum validation (ebf30cf)
- POST /api/crm/work-orders — 500 on missing title, added required field check (ebf30cf)
- Replaced undefined btn/btn-primary/btn-secondary classes with auth-btn/quick-action-btn across 4 components (0d76364)
- Replaced native date input with DatePicker component in LeadDetail custom fields (0d76364)

### UI Consistency Fixes
- SettingsView SMTP: btn btn-primary -> auth-btn on save + test buttons
- SettingsView Financing: inline-styled inputs -> form-input class on API key + merchant ID
- WorkOrdersView: btn btn-primary -> auth-btn on add milestone button
- ImportLeadsModal: btn-primary -> auth-btn on import + done buttons
- StormCatalog: btn/btn-primary/btn-secondary -> auth-btn/quick-action-btn on time range pills
- LeadDetail: native date input -> DatePicker component for custom date fields
- LeadDetail: inline-styled text/number inputs -> form-input class for custom fields

### Known Issues Remaining
- Admin panel requires super_admin role to test
- Pipeline drag-and-drop not exercised (no browser automation)
- CSV export/import not verified end-to-end
- Email send requires SMTP configuration
- Calendar event creation not tested via browser
- QuickBooks, Twilio, Stripe integrations not implemented

---

## QA Run: 2026-04-16

### Test Results
- Pages tested: 5
- API endpoints tested: 250+ (37 route files)
- Bugs found: 8
- Bugs fixed: 8
- UI inconsistencies found: 12
- UI inconsistencies fixed: 12

### Fixes Made
- POST /api/financing/public/:token/apply — added planId required check and token error handling (1fb9b3f)
- POST /api/crm/leads/:id/contacts — require at least one contact field (1fb9b3f)
- PATCH /api/crm/canvass-pins/:id — added UUID validation (005a6eb)
- POST /api/crm/canvass-pins/:id/convert — added UUID validation (005a6eb)
- GET /api/materials/orders/:id — added UUID validation (005a6eb)
- POST /api/materials/estimate/:estimateId/auto-order — added UUID validation (005a6eb)
- PUT /api/skip-trace/config — require 'enabled' boolean (005a6eb)
- PATCH /api/crm/tasks/:id — map completed boolean to completed_at timestamp (738661f)

### UI Consistency Fixes
- Replaced 11 inline SVGs with @heroicons/react/24/outline across EstimatesView, LeadDetail, WorkOrdersView, AddressSearch (9e7ac88)
- Standardized auth-btn styling on SubcontractorsView — removed inline borderRadius and padding overrides (af86637)

### Known Issues Remaining
- Admin panel requires super_admin role to test
- Pipeline drag-and-drop not exercised (no browser automation)
- CSV export/import not verified end-to-end
- Email send requires SMTP configuration
- Webhook endpoints need signature verification keys
- QuickBooks, Twilio, Stripe integrations not implemented

---

## QA Run: 2026-04-17

### Test Results
- Pages tested: 17
- API endpoints tested: 160+
- Bugs found: 3
- Bugs fixed: 3
- UI inconsistencies found: 8
- UI inconsistencies fixed: 8

### Fixes Made
- GET /leads/status/public/:token 500 — removed non-existent `state`/`zip` columns, fixed `company_name` → `name`, fixed `stage_change` → `status_change` enum (04c0ee8)
- dripService.js — `company_name` → `name` column fix in tenants query (e30be36)
- POST /crm/test-email — added `|| {}` fallback for missing Content-Type header (e30be36)

### UI Consistency Fixes
- StormCatalog: inline SVG close → XMarkIcon (0de487f)
- StormProperties: inline SVG filter → FunnelIcon (0de487f)
- MapControls: inline SVG chevron → ChevronDownIcon (0de487f)
- Pipeline: inline SVG arrow → ArrowLeftIcon (0de487f)
- OnboardingPage: 3 inline SVGs → CheckIcon, LockClosedIcon (0de487f)
- PublicEstimate: 3 inline SVGs → CheckIcon, CreditCardIcon, WalletIcon (0de487f)

### Known Issues Remaining
- Admin panel requires super_admin role to test
- Pipeline drag-and-drop not exercised (no browser automation)
- CSV export/import not verified end-to-end
- Email send requires SMTP configuration
- Webhook endpoints need signature verification keys
- QuickBooks, Twilio, Stripe integrations not implemented

---

## QA Run: 2026-04-22

### Test Results
- Pages tested: 17
- API endpoints tested: 160+
- Bugs found: 2
- Bugs fixed: 2
- UI inconsistencies found: 1
- UI inconsistencies fixed: 1

### Fixes Made
- `/leads/:id` route missing — added route in `App.jsx` and wired `LeadList.jsx` to auto-open the detail panel from URL param so dashboard/deep-link navigation no longer falls through to the catch-all redirect (eabc81c)
- EstimatesView numbered-list button used inline SVG inconsistent with adjacent Heroicon bullet-list button — replaced with `NumberedListIcon` from `@heroicons/react/24/outline` (ce87ade)

### UI Consistency Fixes
- EstimatesView rich-text toolbar: inline numbered-list SVG → `NumberedListIcon` (ce87ade)

### Known Issues Remaining
- Admin panel requires super_admin role to test
- Pipeline drag-and-drop not exercised end-to-end in-browser
- CSV export/import binary download not verified
- Email send requires SMTP configuration
- Webhook endpoints need signature verification keys
- QuickBooks, Twilio, Stripe integrations not implemented
- Mobile responsive (375px/768px) not measured this run
- File upload on lead detail not exercised

---

## QA Run: 2026-04-24

### Test Results
- Pages tested (screenshots produced or refreshed): 21 (15 new, 6 updated)
- API endpoints tested: 0 fully-logged endpoints this run (test harness built but not executed to completion)
- Bugs found: 2
- Bugs fixed (committed): 1
- Bugs fixed (uncommitted, in working tree): 1
- UI inconsistencies found: 2 (both inline-SVG star ratings)
- UI inconsistencies fixed: 2

### Fixes Made
- Dashboard.jsx `StarRating` and StormCatalog.jsx severity stars rendered with raw inline `<svg>` paths instead of Heroicons — replaced with `StarIcon` from `@heroicons/react/24/outline`, preserving filled/unfilled visual via a `fill` style prop (18f337a)
- server/src/routes/admin.js — added `validateId()` middleware to `GET /api/admin/tenants/:id` and `PUT /api/admin/tenants/:id` to prevent a raw 500 on a non-UUID path param (uncommitted in working tree; matches the CRM UUID-validation pattern from 3577c4a / 005a6eb)

### New Infrastructure
- server/scripts/api-test.sh — reusable ~340-line bash harness that hits ~160+ endpoints in one pass, marks HTTP 500/502/504 as `CRASH`, and writes a skimmable log suitable for regression diffs (uncommitted in working tree)

### UI Consistency Fixes
- Dashboard.jsx: inline-SVG `StarRating` → `StarIcon` heroicon (18f337a)
- StormCatalog.jsx: severity-row inline SVGs → `StarIcon` heroicon (18f337a)

### Session Integrity
- All 5 overnight child sessions hit `error_max_turns`: s1=51, s2=81, s3=61, s4=41, s5=0B
- The s5 report session produced a zero-byte JSON — this report was written in a follow-up session
- Total cost for the 4 sessions that did produce work: ~$14.48

### Known Issues Remaining
- Admin panel requires super_admin role to test
- Pipeline drag-and-drop not exercised end-to-end in-browser
- CSV export/import binary download not verified
- Email send requires SMTP configuration
- Webhook endpoints need signature verification keys
- QuickBooks, Twilio, Stripe integrations not implemented
- Mobile responsive (375px/768px) not measured systematically this run (one capture only)
- File upload on lead detail not exercised
- Playwright not invoked this run — zero interactive click/fill/drag coverage

---

## QA Run: 2026-04-25

### Test Results
- Pages tested (icon audit sweep): 6 components
- API endpoints tested: 159 (harness) + ~50 nested-`:id` probes
- Bugs found: 1 root cause across 5 endpoints
- Bugs fixed: 1 (5 endpoints, single commit)
- UI inconsistencies found: 29 (1 payments badge × 3 call sites + 28 outlined icons across 6 components)
- UI inconsistencies fixed: 29

### Fixes Made
- `server/src/routes/properties.js` — five nested `:id` routes (`GET /weather-history`, `GET /weather-history/pdf`, `GET /report/pdf`, `PUT /location`, `POST /fema-lookup`) returned `500` on a non-UUID `:id` because `pool.query` threw on the malformed UUID. Added the existing `validateId()` middleware (already imported in the file) to all five routes; they now return `400 {"error":"Invalid id format"}`. Verified by re-running `server/scripts/api-test.sh` (still 0 × 5xx) and ~50 additional targeted nested-`:id` probes (26a3f20)

### UI Consistency Fixes
- Pipeline desktop card, Pipeline mobile card, LeadDetail financing section: `material-symbols-rounded` `payments` glyph → `BanknotesIcon` from `@heroicons/react/24/outline` (b5887e7)
- Dashboard.jsx, EstimatesView.jsx, Pipeline.jsx, StormMap.jsx, TasksView.jsx, WorkOrdersView.jsx: 28 final `material-symbols-outlined` spans → `@heroicons/react/24/outline` equivalents. Codebase now has zero Material Symbols spans (6e779d8)

### Session Integrity
- s1 api-test: success (54 turns, 23 881 output tokens, $2.75)
- s2 frontend-test: error_max_turns (81 turns, 21 297 output tokens, $4.80)
- s3 ui-audit: error_max_turns (61 turns, 17 511 output tokens, $3.28) — produced the two icon-cleanup commits before timing out
- s4 verify: error_max_turns (41 turns, 8 203 output tokens, $2.22)
- s5 report: 0 bytes (did not run; this report written in a follow-up session, same pattern as Run 8)
- Total cost for the four sessions that produced work: ~$13.05

### Known Issues Remaining
- Admin panel requires global super_admin role to fully exercise
- Pipeline drag-and-drop not validated end-to-end in a browser
- CSV export download is not verified as a binary download (only 200 status is checked)
- Email-send endpoints (`/crm/test-email`, `/invoices/:id/send-email`) need SMTP configuration
- Webhook endpoints (`/webhooks/tracerfy`, `/webhooks/hearth`) need signature verification keys
- File upload on Lead Detail (multipart path) not exercised
- QuickBooks, Twilio, Stripe integrations not implemented (pre-existing, not regressions)
- Mobile responsive sweep at 375 px / 768 px not performed systematically this run
- `/properties/in-swath/:stormEventId/count` returns `{"count":0}` for a nil UUID rather than 400 — harmless, left as-is
- Browser-interactive (Playwright) coverage absent since Run 6 — top priority for Run 10

---

## QA Run: 2026-04-26

### Test Results
- Pages tested: 14 full-page captures (qa11) + 7 focused captures (qa12)
- API endpoints tested: 159 (harness) + ~120 (uncovered probe) + ~25 (positive-path E2E)
- Bugs found: 0
- Bugs fixed (committed): 0
- UI inconsistencies found: 3
- UI inconsistencies fixed (uncommitted in working tree): 3

### Fixes Made
- None committed this run. API surface clean for second consecutive run.

### UI Consistency Fixes (uncommitted in working tree)
- `client/src/components/ActivityModal.jsx` — replaced native `<input type="time">` in the follow-up section with the `TimePicker` component, mirroring the existing DatePicker mandate
- `client/src/components/Dashboard.jsx` — `RevenueGoalBar` buttons changed from `rounded-lg` (8px) to `rounded-[12px]` to match the rest of the app
- `client/src/components/WorkOrdersView.jsx` — toolbar padding `var(--space-2xl)` → `var(--space-xl)` to match Leads/Pipeline/Estimates toolbars; `btnStyle.borderRadius` `10` → `12` to match the rest of the app

### Session Integrity
- s1 api-test: success (31 turns, 26 836 output tokens, $2.44)
- s2 frontend-test: error_max_turns (81 turns, 18 089 output tokens, $4.72) — captured the 14 qa11-* full-page screenshots before timing out
- s3 ui-audit: error_max_turns (61 turns, 34 239 output tokens, $4.55) — captured the 7 qa12-* focused screenshots and produced the 3 uncommitted UI fixes in the working tree before timing out
- s4 verify: error_max_turns (41 turns, 13 092 output tokens, $2.57)
- s5 report: 0 bytes — did not run; this report written in a follow-up session (same pattern as Runs 8, 9, 10)
- Total cost for the four sessions that produced work: ~$14.28

### Known Issues Remaining
- Admin panel requires global super_admin role to fully exercise
- Pipeline drag-and-drop not validated end-to-end in a browser (still HTML5 drag API)
- CSV export download is not verified as a binary download (only 200 status checked)
- Email-send endpoints (`/crm/test-email`, `/invoices/:id/send-email`) need SMTP configuration
- Webhook endpoints (`/webhooks/tracerfy`, `/webhooks/hearth`) need signature verification keys
- File upload on Lead Detail (multipart path) not exercised
- QuickBooks, Twilio, Stripe integrations not implemented (pre-existing, not regressions)
- Mobile responsive sweep at 375 px / 768 px not performed this run
- `POST /drift/correct-all` and `POST /properties/trigger-import` accept empty bodies and trigger heavy work — should require explicit confirmation/role params
- `PATCH /admin/tenants/:id` not defined (only `PUT` is) — Express returns default 404 HTML; not a bug per the contract
- Browser-interactive (Playwright) click/fill/drag coverage absent since Run 6 — Run 11 captured screenshots only

---

## QA Run: 2026-04-27

### Test Results
- Pages tested: 19 focused captures (qa12) + 1 verification capture (qa13)
- API endpoints tested: 159 (existing harness) + new `scripts/qa-api-harness.sh` (306 lines, ~80 GETs + ~40 POSTs)
- Bugs found: 3 (2 API ENUM-cast crashes, 1 UI stacking-context)
- Bugs fixed (uncommitted in working tree): 3
- UI inconsistencies found: 1 (Work Orders modal hidden behind page chrome)
- UI inconsistencies fixed (uncommitted in working tree): 1

### Fixes Made
- `server/src/routes/crm.js` — `POST /leads/quick` accepted arbitrary `priority` / `stage` strings, which threw a Postgres `invalid input value for enum` error and returned an opaque 5xx. Added explicit allow-list validation (`hot/warm/cold` for priority; `new/contacted/appt_set/inspected/estimate_sent/sold/lost/negotiating/in_production/on_hold` for stage) returning `400` with a descriptive message before the request reaches the database. Same pattern applied to `POST /tasks` and `PATCH /tasks/:id` for the `priority` field. Three handlers, one root cause. (uncommitted)
- `client/src/components/WorkOrdersView.jsx` — `WorkOrderDetail`, `CreateWorkOrderModal`, and `EstimatePickerModal` mounted inline inside `WorkOrdersView`, which is wrapped by a `.glass` page container that uses `backdrop-filter` and creates its own stacking context. The modal `z-index: 1000` only stacked above siblings of that container, so the modal sat behind page chrome. Wrapped each modal in `createPortal(..., document.body)` so they mount as direct children of `<body>` and escape the parent stacking context entirely. Verified via qa13-wo-detail-portal.png. (uncommitted)

### New Infrastructure
- `scripts/qa-api-harness.sh` — 306-line consolidated bash harness combining positive-path GETs (with both real-looking and bad UUIDs), POST-empty-body probes for ~40 mutating endpoints, and `*** 5xx ***` flagging plus response-body capture for any 5xx. Sources `TOKEN` from env or `/tmp/tok.txt`. Complements (does not replace) `server/scripts/api-test.sh`. (uncommitted)

### UI Consistency Fixes
- `client/src/components/WorkOrdersView.jsx` — three modals wrapped in `createPortal(..., document.body)` (same change as Bug 3 above; this is both a UI-correctness fix and a stacking-context bug fix). (uncommitted)

### Session Integrity
- s1 api-test: error_max_turns (51 turns, 21 866 output tokens, $3.01) — produced the new harness and the two `crm.js` validation diffs before timing out
- s2 frontend-test: error_max_turns (81 turns, 42 243 output tokens, $6.06) — captured most of the qa12 screenshots
- s3 ui-audit: error_max_turns (61 turns, 26 021 output tokens, $4.19) — captured the qa12-wo-detail*.png + qa13-wo-detail-portal.png evidence and produced the WorkOrdersView portal fix before timing out
- s4 verify: error_max_turns (41 turns, 9 179 output tokens, $2.03)
- s5 report: 0 bytes — did not run; this report was written in a follow-up session (same pattern as Runs 8, 9, 10, 11)
- Total cost for the four sessions that produced work: ~$15.29

### Known Issues Remaining
- Admin panel requires global super_admin role to fully exercise
- Pipeline drag-and-drop not validated end-to-end in a browser (still HTML5 drag API)
- CSV export download is not verified as a binary download (only 200 status checked)
- Email-send endpoints (`/crm/test-email`, `/invoices/:id/send-email`) need SMTP configuration
- Webhook endpoints (`/webhooks/tracerfy`, `/webhooks/hearth`) need signature verification keys
- File upload on Lead Detail (multipart path) not exercised
- QuickBooks, Twilio, Stripe integrations not implemented (pre-existing, not regressions)
- Mobile responsive sweep at 375 px / 768 px not performed this run
- ENUM-validation allow-list pattern not yet applied to all other mutating routes that write Postgres ENUM columns (e.g. `POST /crm/activities` writes `activity_type`, `direction`, `outcome`; estimate/work-order status fields)
- `POST /drift/correct-all` and `POST /properties/trigger-import` still accept empty bodies and trigger heavy work — should require explicit confirmation/role params
- Browser-interactive (Playwright) click/fill/drag coverage absent since Run 6 — Run 12 captured screenshots only
- s5 report-writing session has been 0-byte for 5 consecutive runs — the slot should be re-thought

---

## QA Run: 2026-04-28

### Test Results
- Pages tested: 4 baseline captures (qa14-01..04) + 2 verification captures (qa14-fix-pipeline-btn, qa14-fix-workorders-btn)
- API endpoints tested: 159 (existing harness) + ~40 mutating endpoints re-probed for ENUM/UUID handling
- Bugs found: 6 (1 in `POST /crm/activities`, 1 in `POST /estimates`, 1 in `POST /invoices`, 1 in `PATCH /invoices/:id`, 1 in `POST /work-orders`, 1 in `PATCH /work-orders/:id`)
- Bugs fixed: 6 (one commit, `4865288`)
- UI inconsistencies found: 2 (`/pipeline` `Add Lead`, `/work-orders` `New Work Order` primary CTAs)
- UI inconsistencies fixed: 2 (one commit, `23c3746`)

### Fixes Made
- `server/src/routes/crm.js` — `POST /api/crm/activities` now performs UUID format check on `lead_id` and ENUM allow-list check on `type` (`call`, `email`, `text`, `door_knock`, `note`, `status_change`, `task_completed`, `system`) before reaching the database. Closes the 5xx-on-bad-input gap that the Run 12 fix did not cover. (4865288)
- `server/src/routes/estimates.js` — `POST /api/estimates` now performs UUID format check on `lead_id`. (4865288)
- `server/src/routes/invoices.js` — `POST /api/invoices` performs UUID format checks on `lead_id` and (when present) `estimate_id`. `PATCH /api/invoices/:id` performs ENUM allow-list check on `status` (`draft`, `sent`, `viewed`, `paid`, `overdue`, `void`). (4865288)
- `server/src/routes/workOrders.js` — `POST /api/work-orders` performs UUID format checks on `lead_id` and `estimate_id` and ENUM allow-list check on `status` (`pending`, `scheduled`, `in_progress`, `completed`, `cancelled`). `PATCH /api/work-orders/:id` performs the same ENUM allow-list check on `status`. (4865288)
- After this commit every mutating route that writes a Postgres ENUM column or a UUID foreign key on the audited surface performs explicit input validation before the request reaches the database.

### UI Consistency Fixes
- `client/src/components/Pipeline.jsx` — `Add Lead` primary CTA was inline-styled with translucent tinted background (`oklch(0.72 0.19 250 / 0.15)`), 14 px padding, 12 px / 600 font. Replaced with the standard `.auth-btn` class so the button now renders at 36 px height, 24 px horizontal padding, 13 px / 700 font, solid `var(--accent-blue)` background, matching Estimates / Invoices / Contracts / Expenses / Subcontractors / Tasks. Verified via qa14-fix-pipeline-btn.png. (23c3746)
- `client/src/components/WorkOrdersView.jsx` — `New Work Order` primary CTA was inline-styled with translucent tinted background, **32 px** height (not 36 px), 14 px padding, 13 px / 600 font. Replaced with the standard `.auth-btn` class. Verified via qa14-fix-workorders-btn.png. (23c3746)

### New Infrastructure / Carryover
- The Run 12 carryover (`crm.js` priority/stage validation, `WorkOrdersView` modal portals, `scripts/qa-api-harness.sh`) was rolled into the pre-overnight checkpoint commit `3de969e` and is now part of HEAD.

### Session Integrity
- s1 api-test: error_max_turns (51 turns, 32 248 output tokens, $3.80) — produced commit `4865288` before timing out
- s2 frontend-test: error_max_turns (81 turns, 16 741 output tokens, $4.25) — captured the qa14-0* baseline screenshots
- s3 ui-audit: error_max_turns (61 turns, 29 239 output tokens, $4.30) — produced commit `23c3746` and the qa14-fix-* verification screenshots, plus btn-audit.json / form-audit.json / sidebar-audit.json
- s4 verify: error_max_turns (41 turns, 18 468 output tokens, $3.24)
- s5 report: 0 bytes — did not run (6th consecutive 0-byte s5; this report written in a follow-up session)
- Total cost for the four sessions that produced work: ~$15.59
- This is the first overnight run since QA Run 6 (2026-04-17) where every fix landed as a real commit on HEAD before the report was written.

### Known Issues Remaining
- Admin panel requires global super_admin role to fully exercise
- Pipeline drag-and-drop not validated end-to-end in a browser (still HTML5 drag API)
- CSV export download is not verified as a binary download (only 200 status checked)
- Email-send endpoints (`/crm/test-email`, `/invoices/:id/send-email`) need SMTP configuration
- Webhook endpoints (`/webhooks/tracerfy`, `/webhooks/hearth`) need signature verification keys
- File upload on Lead Detail (multipart path) not exercised
- QuickBooks, Twilio, Stripe integrations not implemented (pre-existing, not regressions)
- Mobile responsive sweep at 375 px / 768 px not performed this run — last full sweep was Run 6
- `POST /drift/correct-all` and `POST /properties/trigger-import` still accept empty bodies and trigger heavy work — should require explicit confirmation/role params
- 16 search-input fields render correctly but do not carry the explicit `.form-input` class — refactor candidate, not a regression (form-audit.json)
- Browser-interactive (Playwright) click/fill/drag coverage absent since Run 6 — Run 13 captured screenshots only
- s5 report-writing session has been 0-byte for 6 consecutive runs — the slot should be re-thought (fold into s4 with a longer turn budget, or drop entirely)
- Fresh `/tmp/api-test-results.txt`, `/tmp/frontend-test-results.txt`, `/tmp/ui-audit-results.txt` were not produced this run; api-test path still holds the Run 6 artifact

---

## QA Run: 2026-04-30

### Test Results
- Pages tested: 9 baseline captures (qa14-01..09) + 2 verification captures (qa14r-01-dashboard-ar-currency, qa14r-02-invoices-negative-balance)
- API endpoints tested: 159 (existing harness) — no new endpoint regressions surfaced
- Bugs found: 3 (2 UI currency-formatting bugs + 1 backend 5xx-leak class-of-bug found while reviewing the error envelope)
- Bugs fixed: 2 committed (`485a522`, `b3c1fe9`); 1 patch left in the working tree, uncommitted (`server/src/middleware/errorHandler.js`)
- UI inconsistencies found: 0 new — Run 13 primary-CTA fix (commit `23c3746`) verified to still hold via fresh `btns-pipeline.json`, `btns-estimates.json`, `btns-invoices.json`, `btns-leads.json` captures
- UI inconsistencies fixed: 0 (none required this run)

### Fixes Made
- `client/src/components/Dashboard.jsx` — `formatCurrency` was producing strings like `$-1,000` for negative AR/overpayment values because `$` was a hardcoded prefix and `Number.toLocaleString()` placed the sign in front of the digits. Refactored to split sign from absolute value: `${sign}$${abs.toLocaleString()}`. Negative values now render as `-$1,000` per US accounting convention. Verified at `/` via `qa14r-01-dashboard-ar-currency.png`. (485a522)
- `client/src/components/InvoicesView.jsx` — same display bug on the balance column. Overpaid invoice `INV-0013` rendered as `$-1,000.00`. Same fix shape applied: `{balance < 0 ? '-' : ''}${Math.abs(balance).toLocaleString(...)}`. Verified at `/invoices` via `qa14r-02-invoices-negative-balance.png`. (b3c1fe9)
- `server/src/middleware/errorHandler.js` — **uncommitted patch in working tree**. Translates five Postgres SQLSTATE codes (`22P02` invalid_text_representation, `22008` datetime_field_overflow, `22003` numeric_value_out_of_range, `22007` invalid_datetime_format, `23503` foreign_key_violation) from 500 to 400 with sensible error messages, so any un-validated route returns a client error rather than an opaque 5xx for bad input. Defense-in-depth on top of the route-level UUID/ENUM checks added in Runs 11–13. Diff is clean and isolated to that file. The agent ran out of turns before committing. Recommend committing in next session under `fix(api): translate Postgres input errors to 400 in errorHandler`.

### UI Consistency Fixes
- None this run. The Run 13 primary-CTA standardization (`23c3746`) was re-verified intact: Pipeline `Add Lead`, Estimates `New Estimate`, Invoices `New Invoice` all render at 36 px height / 0 24 px padding / 13 px font / 700 weight (matching `.auth-btn`). Dashboard's full 42-button enumeration (`dashboard-btns.json`) shows no off-spec primary CTAs. No Material Symbols icons reintroduced.

### Audit Evidence Captured
- `btns-dashboard.json` (page-level capture), `dashboard-btns.json` (full 42-button enumeration), `btns-pipeline.json`, `btns-leads.json`, `btns-estimates.json`, `btns-invoices.json`
- 9 baseline screenshots: `qa14-01-dashboard.png`, `qa14-02-pipeline-billing.png`, `qa14-03-leads.png`, `qa14-04-lead-detail.png`, `qa14-05-storm-map.png`, `qa14-06-estimates.png`, `qa14-07-estimate-builder.png`, `qa14-08-invoices.png`, `qa14-09-invoice-modal.png`
- 2 verification screenshots: `qa14r-01-dashboard-ar-currency.png`, `qa14r-02-invoices-negative-balance.png`

### Session Integrity
- s1 api-test: error_max_turns (51 turns, 24 413 output tokens, $3.32) — surfaced the errorHandler.js improvement (uncommitted in working tree)
- s2 frontend-test: error_max_turns (81 turns, 21 917 output tokens, $5.35) — captured the qa14-0* baseline screenshots, surfaced both currency bugs, produced commits `485a522` and `b3c1fe9`
- s3 ui-audit: error_max_turns (61 turns, 19 812 output tokens, $3.52) — captured the five `btns-*.json` files, verified Run 13 CTA fix still holds
- s4 verify: error_max_turns (41 turns, 15 225 output tokens, $2.60) — captured the qa14r-* verification retests
- s5 report: 0 bytes — did not run (7th consecutive 0-byte s5 since Run 8; this report written in a follow-up session)
- Total cost for the four sessions that produced work: ~$14.79

### Known Issues Remaining
- `server/src/middleware/errorHandler.js` defense-in-depth patch sits uncommitted in the working tree — carry forward to next run for review and commit
- Other currency-formatting surfaces (LeadDetail Profit/Expenses, Reports, ContractsView, ExpensesView) not audited for the same `$${num}` anti-pattern that produced Bug 1 and Bug 2 — recommended next-run task
- Admin panel requires global super_admin role to fully exercise
- Pipeline drag-and-drop not validated end-to-end in a browser (still HTML5 drag API)
- CSV export download is not verified as a binary download (only 200 status checked)
- Email-send endpoints (`/crm/test-email`, `/invoices/:id/send-email`) need SMTP configuration
- Webhook endpoints (`/webhooks/tracerfy`, `/webhooks/hearth`) need signature verification keys
- File upload on Lead Detail (multipart path) not exercised
- QuickBooks, Twilio, Stripe integrations not implemented (pre-existing, not regressions)
- `POST /drift/correct-all` and `POST /properties/trigger-import` still accept empty bodies and trigger heavy work — should require explicit confirmation/role params (tracked since Run 11)
- 16 search-input fields render correctly but do not carry the explicit `.form-input` class (tracked since Run 13)
- Mobile responsive sweep at 375 px / 768 px not performed this run — last full sweep was Run 6
- Browser-interactive (Playwright) click/fill/drag coverage absent since Run 6 — Run 14 captured screenshots only
- s5 report-writing session has been 0-byte for 7 consecutive runs — the slot should be re-thought (fold into s4 with a longer turn budget, or drop entirely)
- Fresh `/tmp/api-test-results.txt`, `/tmp/frontend-test-results.txt`, `/tmp/ui-audit-results.txt` were not produced this run; api-test path still holds the Run 6 artifact
- Form audit + sidebar audit not re-captured this run; latest evidence is from Run 13

---

## QA Run: 2026-05-02

### Test Results
- Pages tested: 13 routes + 15 settings tabs (full Playwright UI sweep — first since Run 6)
- API endpoints tested: 260+ endpoint hits across 36 route files (176 calls in `scripts/qa-api-test.mjs` + 79 in `scripts/qa-api-test-extended.mjs` + targeted curl probes)
- Bugs found: 3
- Bugs fixed: 3 (commits `e61b0c7`, `88e9dfe`, `ba79211`)
- UI inconsistencies found: 2 (icon-discipline violations)
- UI inconsistencies fixed: 2 (rolled into the `88e9dfe` and `ba79211` commits — both fix categories overlap)

### Fixes Made
- `client/src/components/InvoicesView.jsx` — Overdue stat card counted only `status === 'overdue'`, while the row OVERDUE badge fires on `status === 'sent' && new Date(due_date) < now`. Stat showed `0` while a clearly-overdue row was visible. Extended the filter to match the badge logic and the dashboard's SQL definition. Verified at `/invoices`: card now shows `1`, agreeing with the OVERDUE row badge. (e61b0c7)
- No backend commits this run. Two new API harness scripts (`scripts/qa-api-test.mjs`, `scripts/qa-api-test-extended.mjs`) were created and used to drive 260+ endpoint hits — both left untracked. Every previous-run fix held under re-probe; Run 14's `errorHandler.js` SQLSTATE patch is now live in checkpoint `7e68f24`.

### UI Consistency Fixes
- `client/src/components/PhotoAnnotator.jsx` + 8 components — drawing toolbar used inline `<svg>` + raw path strings, and eight components rendered raw `&times;` inside close/dismiss `<button>`s instead of `XMarkIcon`. Notably `EstimatesView`, `InvoicesView`, `LeadList`, and `Pipeline` already imported `IconX` but used `&times;` in places — inconsistent within the same file. Standardized on `IconX` / `XMarkIcon` plus `aria-label`s, and swapped the PhotoAnnotator toolbar icons for `PencilIcon` / `ArrowUpRightIcon` / `StopIcon` / `StopCircleIcon` / `DocumentTextIcon`. Files touched: `PhotoAnnotator`, `CanvassingMode`, `CreateLeadModal`, `SubcontractorsView`, `EstimatesView` (3), `InvoicesView`, `LeadList` (2), `Pipeline`. +49 / -37 lines. (88e9dfe)
- `client/src/components/WorkOrdersView.jsx` — "Remove milestone" buttons rendered a literal `×` character. Swapped for the `IconX` wrapper already imported in the file, plus `aria-label="Remove milestone"`. +4 / -3 lines. (ba79211)
- After these two commits, `git grep` for `&times;`, raw `<svg>` icon paths in view components, and `material-symbols-*` returns clean across `client/src` (audited categories — does not include intentional non-icon SVGs like chart geometry).

### Audit Evidence Captured
- 16 refreshed Playwright screenshots in working tree: `qa-storm-map.png`, `qa-pipeline.png`, `qa-leads.png`, `qa-lead-detail.png`, `qa-estimates.png`, `qa-estimate-builder.png`, `qa-invoices.png`, `qa-invoices-after.png`, `qa-work-orders.png`, `qa-work-orders-after.png`, `qa-work-order-detail.png`, `qa-tasks.png`, `qa-calendar.png`, `qa-reports.png`, `qa-canvassing.png`, `qa-settings.png`, `qa-invoice-modal.png`
- New harness scripts in working tree: `scripts/qa-api-test.mjs` (315 lines, 176 calls), `scripts/qa-api-test-extended.mjs` (185 lines, 79 calls)

### Session Integrity
- s1 api-test: **completed** (34 turns, 30 297 output tokens, $2.68) — first fully-clean API sweep in the 15-run series
- s2 frontend-test: error_max_turns (81 turns, 27 809 output tokens, $5.42) — produced commit `e61b0c7`, captured baseline screenshots, first full UI sweep since Run 6
- s3 ui-audit: error_max_turns (61 turns, 40 104 output tokens, $4.91) — produced commits `88e9dfe` and `ba79211`
- s4 verify: error_max_turns (41 turns, 11 004 output tokens, $2.25)
- s5 report: 0 bytes — did not run (8th consecutive 0-byte s5 since Run 8; this report written in a follow-up session)
- Total cost across the four sessions that produced work: ~$15.26
- Two consecutive runs now where every fix landed as a real commit on HEAD before the report was written

### Known Issues Remaining
- `POST /drift/correct-all` and `POST /properties/trigger-import` still accept empty bodies and trigger heavy work — should require explicit confirmation/role params (tracked since Run 11)
- 16 search-input fields render correctly but do not carry the explicit `.form-input` class (tracked since Run 13, `form-audit.json`)
- Pre-token-attach 401 noise on `/api/properties/import-progress`, `/api/notifications/unread-count`, `/api/crm/tenant-settings` — cosmetic console noise on first paint, no functional impact
- Reports chart label overlap — "Mar 26" / "Apr 26" tick labels overlap the "$0" y-axis label on the Revenue chart at narrow widths
- Other currency-formatting surfaces (LeadDetail Profit/Expenses, Reports, ContractsView, ExpensesView, EstimatesView totals) not audited for the `$${num}` anti-pattern that produced Run 14's bugs
- Admin panel requires global super_admin role to fully exercise
- Email-send endpoints (`/crm/test-email`, `/invoices/:id/send-email`) need SMTP configuration for live delivery testing
- Webhook endpoints (`/webhooks/tracerfy`, `/webhooks/hearth`) need signature verification keys
- File upload on Lead Detail (multipart path) probed only with empty multipart body, not with a real file payload
- CSV export download verified by 200 status only, not by binary content-type and download triggering
- QuickBooks, Twilio, Stripe integrations not implemented (pre-existing, not regressions)
- Mobile responsive sweep at 375 px / 768 px not performed this run — last full sweep was Run 6 (9 runs ago)
- Browser-interactive (Playwright) click/fill/drag write coverage absent since Run 6 — Run 15 opened modals and verified rendering, but did not submit Add Lead, drag pipeline cards, upload documents, or record payments
- s5 report-writing session has been 0-byte for 8 consecutive runs — fold into s4 with a longer turn budget, or drop entirely
- Fresh `/tmp/api-test-results.txt`, `/tmp/frontend-test-results.txt`, `/tmp/ui-audit-results.txt` were not produced this run; api-test path still holds the Run 6 artifact (s1 wrote results into the JSON instead)
