# Competitor UI Research — Visual Comparisons

**Date:** 2026-03-30 (updated — refreshed all competitor research via WebSearch + WebFetch)
**Methodology:** Web scraping of competitor websites, product pages, help docs, review sites, and integration partner pages.
**Competitors:** HailTrace, JobNimbus (+ SumoQuote), RoofLink, Rooftops.ai, QuoteIQ
**Companion doc:** `docs/competitor-gap-analysis.md` (text feature analysis — not duplicated here)

---

## 1. Storm Map (HailTrace vs StormLeads)

### What HailTrace Shows

**Map Interface:**
- Full-screen interactive map with storm swath polygons overlaid on satellite/street imagery
- Search bar at top for location/address lookup
- State filter dropdown ("Filter by states" with multi-select)
- Date range picker for filtering storms by timeframe
- Pagination controls for browsing storm archive (Prev/Next)
- Professional color palette: dark backgrounds (#203431), green accents (#009344), white content areas, light gray (#F0F0F0) secondary

**Color/Severity System:**
- **Star rating system (1-5 stars)** per storm map — factors: number of affected properties, maximum hail size, initial probability of finding damage. 5-star = year's most impactful storms
- **"Purple Zones"** indicate highest-severity areas — integration partners (SPOTIO, KnockBase) specifically reference routing crews to "Purple Zones first — the neighborhoods most likely to file claims and approve work"
- Swaths are color-graduated by severity (exact gradient is proprietary but the visual differentiation is a key selling point)
- Each map shows: hail size data, wind speed, affected property count, NOAA reports

**Property Data Popups:**
- Available as download packages (single property, storm swath area, or custom-drawn polygon)
- Data sourced from Cole Information, updated quarterly
- Fields: address, owner info, property details, weather history
- Separate residential vs commercial data plans

**Honey Hole Finder:**
- Load multiple historical storm swaths simultaneously on the same view
- Overlap areas where several storms hit the same region show as darker/denser overlays
- Enables identifying "honey holes" — areas with repeated storm damage = higher close rates

**Layer Controls:**
- Toggle between hail, wind, hurricane, tornado map layers
- NOAA report overlay integration
- Real-time weather radar layer
- Custom draw tool for selecting geographic areas

**Dashboard (separate from map):**
- Revenue tracking widgets
- Weekly performance statistics
- Lead pipeline with customizable stages (Opportunities pipeline)
- Data-driven analytics for tracking leads in one place

### What StormLeads Currently Shows

- Google Maps hybrid view with storm swath polygons (NOAA SPC/MRMS data)
- FEMA property overlay (tile-based, 5000 property cap)
- County property overlay
- Honey Hole Finder (10-year SWDI hail history heat map)
- Layer toggle controls with time range filter (24h-30d)
- Swath opacity slider
- "Houses Only" toggle
- Property popups: address, owner, year built, sqft, roof type, hail risk score, 5-year hail chart
- Add-to-pipeline from popup
- Address search with StreetView
- Mobile storm feed sidebar

### Specific Gaps

| HailTrace Feature | StormLeads Status | Priority |
|---|---|---|
| Star rating per storm (1-5) | Not implemented | Medium — adds instant severity assessment |
| Purple Zone / color graduation by severity | Not implemented (uniform swath color) | **High** — #1 visual credibility gap |
| Multi-swath overlay for Honey Hole analysis | Partially done (heat map, not swath overlay) | Low — heat map achieves similar goal |
| Meteorologist verification badges | Cannot replicate (human-dependent) | N/A |
| Residential/commercial data downloads | Not implemented (add-to-pipeline only) | Medium — CSV export of properties in swath |
| Custom draw tool for area selection | Not implemented | Medium — useful for territory creation |

### Recommended Improvements

1. **Hail swath color graduation** — Implement graduated opacity/color by hail size: light green (<1"), yellow (1-1.5"), orange (1.5-2"), red (>2"). This is the single most impactful visual improvement for storm map credibility.
2. **Storm severity badges** — Add a 1-5 star or severity badge to each storm swath tooltip showing: max hail size, affected property estimate, damage probability.
3. **"Download properties in area"** — Allow CSV export of all FEMA properties within a drawn polygon or storm swath, not just one-at-a-time add-to-pipeline.

---

## 2. Pipeline / CRM (JobNimbus vs StormLeads)

### What JobNimbus Shows

**Boards (Kanban) Interface:**
- Columns called "Lists" — each List maps to one or more job statuses
- Cards are white boxes with customizable content via short-code templates
- **Card contents (configurable):**
  - Line 1: Contact/Job name (customizable via templates)
  - Line 2: Contact type, status info
  - Line 3: Financial data (e.g., "Sum of all Approved Invoices")
  - Additional lines: Balance due, custom fields
- **Fixed bottom row on every card (not customizable):**
  - Days in current status (number badge)
  - Task completion ratio (e.g., "3/5 tasks")
  - Attachment count (documents + photos)
  - Due date (if scheduling enabled)
  - Assignee profile pictures/initials + count badge
- **Column headers** can show aggregate totals: Estimate Total, Invoice Total, or Outstanding Invoice Total across all visible cards
- Drag-and-drop between Lists changes job status
- Admin users can configure board layout, card templates, list sorting

**Color Scheme:**
- Blue primary (#4D85E5, #3968c6) on light backgrounds (#ebf0fa)
- White cards on subtle blue-gray backgrounds
- Nav bar transitions from light to dark blue on scroll
- User complaint: "blues are so similar you can't easily see the slider bars"

**Pipeline Stages (Sales Dashboard):**
- Three-stage funnel: Lead → Estimating → Sold
- Shows contact/job counts at each stage
- Filterable by sales rep, job type, lead source

**Multiple Board Types:**
- Customizable project boards per workflow
- Up to 3 boards (Essentials), 5 (Pro), Unlimited (Premium/Enterprise)
- Template boards with pro tips available

### What StormLeads Currently Shows

- 3 board tabs (Sales / Production / Billing)
- Drag-drop stage changes
- Conversion rates between columns
- Days-in-stage badges (color-coded)
- Task progress badges on cards
- Deal value per card + column totals
- Lead score badges + source badges on cards
- Financing status badges
- Priority indicators, hail size badges, due date badges
- Rep avatars
- Column collapse (localStorage)
- Mobile board + list views
- Filter by priority/source/rep with active filter pills
- CreateLeadModal inline

### Specific Gaps

| JobNimbus Feature | StormLeads Status | Priority |
|---|---|---|
| Customizable card templates (short-codes) | Not implemented — fixed card layout | Medium |
| Attachment count on cards | Not shown | Low |
| Column aggregate totals (Invoice/Estimate) | Have deal value totals | Already done |
| Multiple board configurations per user | 3 fixed boards | Low |
| Sales Pipeline 3-stage funnel view | Have conversion rates | Already better |

### Recommended Improvements

1. **Attachment/photo count badge on cards** — Small paperclip icon + count. Quick visual for "has this lead been documented?"
2. **Customizable card fields** — Allow users to choose which 3-4 data fields show on each card (currently fixed). Not high priority since our cards already show more info than JN.
3. **Property thumbnail on card** — RoofLink shows property image on pipeline cards. Consider adding a small satellite/street view thumbnail.

### StormLeads Advantages Over JobNimbus

- Lead score badges (JN doesn't have lead scoring)
- Source badges on cards
- Conversion rates between columns
- Financing status badges
- Hail size badges
- 3 pre-built boards (Sales/Production/Billing) vs JN's generic boards
- No per-board limits on any tier

---

## 3. Estimates & Proposals (JobNimbus/SumoQuote + RoofLink vs StormLeads)

### What SumoQuote (JobNimbus) Shows

**Proposal Builder:**
- Multi-page proposal document with distinct page types:
  1. **Cover Page** — Company logo, brand colors, property image, contact details, color palette toggle
  2. **Introduction Pages** — Templated text with company messaging
  3. **Inspection/Photo Pages** — Embed field photos telling the "full story" of damage
  4. **Quote Details Pages** — Line items pulled from Products & Services catalog, organized into sections (displayed in blue), per-line image support, hover actions for delete/edit
  5. **Authorization Pages** — E-signature with upgrade option add-ons
  6. **Custom Pages** — PDF import, Canva library integration
- **Template System:**
  - Introduction templates, Quote Details templates, Authorization templates, Email templates, Custom text pages
  - Templates shareable across team or kept private
  - Measurement tokens + text tokens for dynamic content insertion
- **Customer Experience:**
  - Professional branded PDF output
  - Customers reportedly chose vendors based on "the report" quality
  - Financing option display for budget-conscious customers
- **Workflow:**
  - Take photos at property → build quote on phone in 5 minutes
  - Price lists for instant pricing
  - Line item syncing back to JobNimbus CRM
  - Email + activity tracking in CRM activity feed

### What RoofLink Shows

**Multiple Estimates Feature:**
- Create up to **6 estimate options per prospect**
- **Good/Better/Best presentation** in PDF format
- Preview profit margins before sharing with homeowner
- Dropdown comparison between options
- Real-time profit margin calculation built into estimate
- Auto-generated from satellite measurements
- One-click material ordering from estimate → SRS supplier PO

### What StormLeads Currently Shows

- Estimate builder with line items + SRS catalog integration
- Template system with saved templates
- RichTextEditor for custom sections
- Discount management (% or $)
- Tax rate selector
- Multi-signer authorization
- Auto-save (2s debounce)
- Send-for-signing modal with email templates + merge tokens
- Good/Better/Best tier generation + comparison view (side-by-side)
- Financing plan selection (Hearth integration)
- Section images
- Duplicate estimate, print/PDF (window.print)

### Specific Gaps

| Competitor Feature | StormLeads Status | Priority |
|---|---|---|
| Cover page with branding (logo, colors, property photo) | Not implemented | **High** — first impression |
| Inspection photo pages in proposal | Not implemented | **High** — key sales tool |
| Professional server-side PDF generation | Uses browser print dialog | **High** — #2 overall gap |
| Up to 6 estimate options (RoofLink) | Have 3 (Good/Better/Best) | Low — 3 is sufficient |
| Measurement tokens in templates | Not implemented | Medium |
| Real-time profit margin on estimate | Have expenses/profit in LeadDetail | Low |
| Canva library integration | Not applicable | N/A |

### Recommended Improvements

1. **Server-side PDF generation** — Use pdfmake or Puppeteer to generate branded multi-page PDFs with: cover page (logo, property photo, company colors), inspection photo pages, line items, terms, and e-signature page. This is the single biggest quality gap visible to customers.
2. **Estimate cover page** — Add fields for company logo, property image (from documents/street view), and branded header. Even without server PDF, improving the on-screen estimate presentation matters.
3. **Inspection photo section** — Allow adding photos from the lead's documents directly into estimate sections, organized by inspection area (roof, gutters, siding, etc.).

---

## 4. Content & Marketing (Rooftops.ai vs StormLeads)

### What Rooftops.ai Shows

**AI Creator Studio:**
- Content types available:
  1. Social media ads (with scheduling across platforms)
  2. Email marketing campaigns
  3. Call scripts
  4. Landing page content
  5. Strategy documents
  6. Legal documents
  7. Employee training guides
  8. SEO optimization content
  9. Content calendar planning
  10. AI-generated images
  11. Multi-language translation (80+ languages)
  12. Meeting optimization docs
- **Workflow:** Select content type → input business details/variables → AI generates content → schedule/publish/save
- **Social Media Manager:** Schedule posts, analyze engagement metrics, track performance over time
- **Creator Library:** Save and organize generated content for reuse

**Rooftops GPT (AI Assistant):**
- ChatGPT-style conversational interface customized for contractors
- Real-time business insights
- Email drafting, task help, roofing Q&A
- Private/secure conversations

**AI Customer Service Bot:**
- Website chatbot widget for 24/7 customer service
- Instant replies, lead capture
- Customizable branding/tone
- Converts positive feedback into testimonials

**AI City Maps (Beta):**
- Google Maps integration with geospatial analytics
- Solar potential assessment overlays
- Financial analysis per property

**AI Employees (Coming Soon, $199/mo):**
- Marcus — Sales follow-up automation
- Aisha — Marketing content/SEO
- Elena — Estimating
- Ryan — Insurance claims

### What StormLeads Currently Shows

- Content Studio with 5 content types (Social, Door Hangers, Emails, Blog, Ad Copy)
- 4 tone options per content type
- 10 input variables
- Batch mode (5 variations)
- Live preview panel (side-by-side)
- Library tab: save/search/filter/copy/delete
- localStorage persistence
- **NOT AI-powered** — template-based string interpolation
- **Not in sidebar** — discovery issue

### Specific Gaps

| Rooftops.ai Feature | StormLeads Status | Priority |
|---|---|---|
| AI-powered generation (LLM) | Template-based only | **High** — core differentiator |
| Social media scheduling | Not implemented | Medium |
| AI-generated images | Not implemented | Low |
| SEO optimization | Not implemented | Low |
| Multi-language translation | Not implemented | Low |
| Content calendar | Not implemented | Medium |
| AI chatbot for website | Not implemented | Low |
| Engagement analytics | Not implemented | Low |
| 12+ content types | 5 content types | Medium |

### Recommended Improvements

1. **Add Content Studio to sidebar** — Immediate fix. Users can't discover it.
2. **LLM integration for content generation** — Replace template interpolation with actual AI generation. Even a basic OpenAI/Anthropic API call would dramatically improve output quality. Consider free-tier LLM options or very low per-token costs.
3. **Add content types:** Call scripts, landing page copy, legal docs (contracts terms), training materials. These are high-value for contractors.
4. **Social media scheduling** — Even a basic "copy to clipboard + open platform" workflow would help. Full scheduling requires social API integrations.

---

## 5. Work Orders & Production (RoofLink vs StormLeads)

### What RoofLink Shows

**7-Step Workflow Visualization:**
1. **Target** — Territory mapping overlaid with storm data, weather radar
2. **Measure** — Satellite roof measurements (Hover/EagleView), gutter takeoff, fence measurements, no-climb required
3. **Estimate** — Auto-generated from measurements with real costs, real-time profit margin visibility, Good/Better/Best tiers
4. **Approve** — Back-office verification step; approval auto-triggers next steps
5. **Order** — Automatic supplier POs to SRS Distribution + crew work order generation, one-click from estimate
6. **Install** — Templated checklists with photo prompts per line item, issue tracking, delay management. **Photo-required milestone hard stops** — can't advance stage without uploading required photos
7. **Collect** — Payment processing for retail and insurance jobs (Stripe)

**Production Board:**
- Milestone completion automatically advances project through pipeline
- Dashboard updates in real-time as milestones complete
- CompanyCam integration: field photos auto-flow into correct customer profile, tagged to estimates/invoices/reports
- Job Photo Organization: photos organized by inspection line items
- Auto-generates homeowner-ready PDFs with photo documentation for insurance

**Key UI Pattern:**
- Everything connected: measurements → estimate → approval → PO → work order → payment
- One-click transitions between steps
- Mobile-first: reps build estimates and manage jobs from phone
- Profit-first compensation: commission tied to gross profit, visible in real-time

### What StormLeads Currently Shows

- 4-column kanban (Pending/Scheduled/In Progress/Completed)
- Drag-drop status changes
- Create from estimate
- Detail modal with milestones (add/toggle/delete/photo upload)
- Milestone templates for 8 job types (tear-off, shingle install, metal install, flat roof, gutter, siding, fence, general repair)
- Editable line items with running total
- Crew assignment
- Scheduled date/time

### Specific Gaps

| RoofLink Feature | StormLeads Status | Priority |
|---|---|---|
| Photo-required milestone hard stops | Not implemented | **High** — quality control |
| Auto-trigger PO on approval | Not implemented (manual ordering) | Medium |
| CompanyCam auto-sync photos | Not applicable (no CompanyCam) | N/A |
| Auto-generate insurance PDF with photos | Not implemented | Medium |
| Real-time profit margin on work order | Not shown on work order view | Low |
| 7-step visual workflow tracker | 4-column kanban | Low — kanban is sufficient |

### Recommended Improvements

1. **Photo-required milestones** — Add a `photo_required` flag to milestone templates. When toggled on, the milestone can't be marked complete without at least one photo upload. This is RoofLink's strongest production feature and a real quality control tool.
2. **Insurance documentation PDF** — Auto-generate a PDF from work order photos + milestones for insurance claim support. Reuse the photo annotation feature already built.
3. **Estimate → Work Order → Expense profit tracking** — Show real-time profit (estimate total - expenses) on the work order detail view, not just LeadDetail.

---

## 6. Dashboard & Reports (JobNimbus + RoofLink vs StormLeads)

### What JobNimbus Shows

**Dashboard Layout:**
- Two tabs: **Classic** and **Sales**
- **Classic Dashboard:**
  - Customizable widget layout — check boxes to show/hide reports
  - Tasks, contacts, jobs, and custom reports
  - "Customize" button in top right
- **Sales Dashboard (Insights):**
  - KPI cards: Leads, Close Rate, Sold Deals (prominently displayed)
  - Sales Pipeline Report: 3-stage funnel (Lead → Estimating → Sold) with contact/job counts
  - Lead Source Report: lead count, sold count, sold rate per source
  - Revenue Leaderboard — Sold: total approved/invoiced estimates per rep
  - Deals Leaderboard — Sold: deal count per rep
  - Average Deal Size — Sold: total revenue / total jobs
  - Bar charts and leaderboard-style rankings
  - Color-coded pipeline stages
  - Filterable by: sales rep, job type, lead source
  - Year-to-date metrics including top 5 revenue-yielding lead sources

**Business Overview Dashboard (Newer):**
- Eagle-eye view of key business metrics
- Filterable by sales rep, job type, lead source
- Pinpoint successes and troubleshoot problems

**Profit Tracker:**
- Per-job view accessible from Job detail → Profit Tracker tab
- **Top metrics bar:** Revenue, profit figures, customizable via "View More" sidebar
- **Cost section:** Imported line items grouped by Manual Section or Cost Type, planned vs actual totals, drag-and-drop reorder, section management (duplicate/delete/rename)
- **Commissions panel:** Assign payouts to sales reps based on revenue or profit percentages
- **Metrics cards:** Draggable, up to 5 favorites pinned to main display

**User Complaints:**
- Insights reporting described as "AWFUL" by some users
- Often need to export to Excel and combine multiple reports
- Mobile app reporting is weak

### What RoofLink Shows

- Custom dashboard widgets (user-configurable)
- Custom reports
- Performance metrics
- Profit-first compensation tracking (commission tied to gross profit)
- Real-time profit margins visible from estimate through completion

### What StormLeads Currently Shows

- 4 stat cards (Pipeline Value, New Leads, Close Rate, Avg Days to Close) with change badges
- Revenue goal progress bar with inline edit
- Pipeline funnel (clickable stages → navigate to filtered leads)
- Mini storm map
- Storm activity feed (24h/7d/30d toggle)
- Today's tasks with checkboxes + follow-ups
- Activity feed timeline
- Storm conversion rates panel
- Estimates status summary
- Team leaderboard table
- Loading skeletons with shimmer
- Reports page: 6 reports (Revenue area chart, Pipeline bar with drill-down, Conversion by Source radar, Rep Leaderboard table, Lead Sources donut with drill-down, Stage Duration line chart)
- Period presets + custom date range + comparison periods with delta badges + trend arrows
- CSV export per report

### Specific Gaps

| Competitor Feature | StormLeads Status | Priority |
|---|---|---|
| Customizable dashboard widgets | Fixed layout | Low — current layout is comprehensive |
| Per-job Profit Tracker (planned vs actual) | Have expenses + profit in LeadDetail | Medium |
| Commissions tracking per rep | Not implemented | Medium |
| A/R (Accounts Receivable) dashboard | Not implemented | Medium |
| Filter dashboards by rep/source/type | Not implemented on main dashboard | Medium |
| Draggable/rearrangeable metric cards | Not implemented | Low |

### Recommended Improvements

1. **Dashboard filter controls** — Add dropdowns to filter all dashboard cards by: sales rep, lead source, date range. JN's Insights does this and it's powerful for managers.
2. **A/R summary widget** — Add an aging summary (Current / 1-30 / 31-60 / 61-90 / 91+ days) to the dashboard or Reports page. Critical for cash flow management.
3. **Per-job profit tracking** — Already have expense tracking in LeadDetail. Surface planned vs actual comparison more prominently with a visual gauge.

### StormLeads Advantages

- Storm-specific dashboard widgets (storm activity feed, conversion rates, mini map) — unique
- Comparison periods with delta badges + trend arrows — JN doesn't have this
- Chart drill-down on Pipeline + Lead Sources — recently added
- Revenue goal progress bar — simple but effective motivator
- Loading skeletons — polished UX detail

---

## 7. QuoteIQ (Emerging Threat)

### What QuoteIQ Shows

**AI Estimator:**
- Upload roof photos → AI analyzes shingle condition, damage severity, pitch, square footage, scope
- Market-accurate pricing by geographic location
- Follow-up questions about tear-off vs overlay, materials, decking
- Complete estimate generated in 4-7 minutes

**MapMeasure Pro:**
- Draw over satellite imagery to calculate square footage and pricing
- Pin dropping, complex shape mapping
- Ridge, valley, hip measurement
- Export directly into estimate builder

**QuoteIQ Cam:**
- Custom inspection forms
- Unlimited 4K photo/video uploads
- Annotations + before/after comparisons
- Customer History Documentation Archive
- Professional roof inspection report generation

**AI Virtual Call Team:**
- 24/7 inbound call answering + lead qualification
- Outbound calling — can cold-call 300 homeowners in storm zones
- Conversation AI, not just IVR

**Other AI Tools:**
- AI Autopilot — 35-tool natural language CRM control ("create an invoice for...")
- Before/After AI Image Generator — show homeowners what new roof will look like
- AI Text Generator — marketing copy
- Review Multiplier — automated review requests
- InstaQuote — homeowner self-service quoting widget on contractor's website

**Pricing:** $29.99-$399.99/mo with AI on ALL plans (vs JN $298/mo add-on for AI)

### Relevance to StormLeads

QuoteIQ is the biggest pricing threat — their $29.99/mo matches our proposed Starter tier but includes AI tools. **However, QuoteIQ has ZERO storm data/weather mapping.** This is StormLeads' moat. Key takeaways:

1. **AI-powered features are table stakes** for 2026 roofing CRM competition
2. **Photo-based estimation** is a powerful differentiator we should consider
3. **Self-service quoting widgets** (InstaQuote) could drive lead generation
4. **Storm data is our competitive moat** — no competitor at this price point has it

---

## 8. Cross-Cutting UI Patterns

### Navigation Patterns

| Competitor | Nav Style | Mobile |
|---|---|---|
| JobNimbus | Top nav with dropdowns (Features, Solutions, Industries, Toolbox) | Native iOS/Android app, 4.8 stars |
| HailTrace | Top nav, dark green (#009344) accent on dark (#203431) background | Native iOS/Android app |
| RoofLink | Mega-menu with collapsible sections (Blueprint, Solutions, Integrations, Resources) | Native app, mobile-first design |
| Rooftops.ai | Standard top nav, clean minimal design | Web responsive |
| **StormLeads** | Collapsible sidebar, dark mode, glass panels | PWA (no native app) |

### Color Systems

| Competitor | Primary | Background | Cards |
|---|---|---|---|
| JobNimbus | Blue (#4D85E5) | Light blue-gray (#ebf0fa) | White |
| HailTrace | Green (#009344) | Dark (#203431) / White | White on gray (#F0F0F0) |
| RoofLink | Navy blue (#3563ad) | Dark navy (#111827) / White | White with generous whitespace |
| Rooftops.ai | Teal/green gradients | White / light | Card-based clean layout |
| **StormLeads** | oklch accent colors | Dark mode first | Glass panels (backdrop-filter) |

### Key Observation

StormLeads' dark-mode glassmorphism design is visually distinctive among competitors. All major competitors use traditional light-mode designs with white cards on light backgrounds. Our design language is more modern but should ensure readability and professional appearance for the contractor audience.

---

## Summary: Top 10 Visual/UI Improvements by Impact

| # | Improvement | Competitor Reference | Effort | Impact |
|---|---|---|---|---|
| 1 | **Server-side PDF estimates** with cover page, photos, branding | SumoQuote/JobNimbus | Large | Critical — visible to customers |
| 2 | **Hail swath color graduation** by severity | HailTrace | Medium | High — map credibility |
| 3 | **AI-powered content generation** (LLM integration) | Rooftops.ai, QuoteIQ | Medium | High — content quality |
| 4 | **Photo-required milestone stops** on work orders | RoofLink | Small | High — quality control |
| 5 | **Estimate inspection photo pages** | SumoQuote | Medium | High — sales tool |
| 6 | **Dashboard filter controls** (rep, source, date) | JobNimbus Insights | Small | Medium — manager tool |
| 7 | **Storm severity badges** (1-5 rating per storm) | HailTrace | Small | Medium — data richness |
| 8 | **Content Studio sidebar link** | N/A (discovery fix) | Tiny | Medium — feature discovery |
| 9 | **A/R aging summary** on dashboard/reports | JobNimbus | Small | Medium — cash flow |
| 10 | **Estimate cover page** with logo + property image | SumoQuote | Small | Medium — first impression |

---

*Generated 2026-03-30 via web research of competitor websites, help docs, review sites (Capterra, SoftwareAdvice, GetApp, G2), integration partner pages (SPOTIO, KnockBase, LettrLabs), and product blog posts.*
