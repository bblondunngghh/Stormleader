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

### What was skipped and why
- Full modal animation integration into individual components — CSS is ready but React components need `animation` class names added to their overlay/modal JSX
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
