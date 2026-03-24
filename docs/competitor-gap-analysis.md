# Competitor Gap Analysis — StormPipe vs JobNimbus + HailTrace + RoofLink + Rooftops.ai

**Date:** 2026-03-24 (updated)
**Methodology:** Web research of competitor features/pricing + hands-on testing of StormPipe at localhost:5173

---

## New Competitors Added (2026-03-24)

### RoofLink ($120/user/month)
- 7-step workflow: Target → Measure → Estimate → Approve → Order → Install → Collect
- Integrations: SRS Distribution, SalesRabbit, QuickBooks, Stripe, Hover, EagleView, CompanyCam, Zapier
- Territory mapping for canvassing with rep assignment
- Direct material ordering from SRS branches
- Satellite roof measurements via Hover/EagleView integration
- Real-time supplier pricing visibility with profit margin calc
- **Key differentiator:** Material ordering pipeline from estimate to supplier PO in one click

### Rooftops.ai ($199/mo for AI employees, $5k white-glove setup)
- AI-powered satellite roof measurements (pitch, facets, sqft)
- Instant cost estimates based on custom pricing tables
- One-click professional proposal generation
- AI assistant for email drafting and task help
- Automated follow-up drip sequences
- Solar upselling analysis built in
- AI Employees (coming soon): automated lead follow-up, content/SEO, social media, 24/7 responses
- **Key differentiator:** AI-first approach to measurements and proposals

---

## Feature Comparison Matrix

| Feature | JobNimbus | HailTrace | RoofLink | Rooftops.ai | StormPipe | Status |
|---|---|---|---|---|
| **CRM & Pipeline** |||||
| Kanban pipeline with drag-and-drop | Yes | No | Yes — /pipeline with customizable stages | Match |
| Contact management with history | Yes | No | Yes — LeadDetail with activities, docs, contacts | Match |
| Lead source tracking | Yes | No | Yes — source field + reports by source | Match |
| Custom fields on leads | Yes ($550/mo plan) | No | Yes — Settings > Custom Fields, free | Better |
| Lead priority/tagging | Yes | No | Yes — priority levels on leads | Match |
| Global search (Cmd-K) | Yes | No | Yes — TopBar search across leads/contacts | Match |
| **Sales & Estimating** |||||
| Estimate builder with line items | Yes (SumoQuote addon) | No | Yes — built-in, no addon needed | Better |
| Estimate templates | Yes | No | Yes — template system in EstimatesView | Match |
| Public estimate page with e-signature | Yes | No | Yes — PublicEstimate.jsx with signature canvas | Match |
| Estimate to invoice conversion | Yes | No | Yes — "From Estimate" button on Invoices | Match |
| **Invoicing & Payments** |||||
| Invoice creation and tracking | Yes | No | Yes — full InvoicesView with status tracking | Match |
| Payment recording | Yes | No | Yes — payment recording on invoices | Match |
| Text-to-Pay / Online payments | Yes ($49-249/mo addon) | No | Yes — Stripe integration (Payments tab) | Better |
| Financing integration | Yes (Sunlight Financial) | No | Yes — Hearth financing in Settings | Match |
| QuickBooks sync | Yes | No | No | Missing |
| **Scheduling & Tasks** |||||
| Calendar with scheduling | Yes | No | Yes — FullCalendar with month/week/day/list | Match |
| Task management | Yes | No | Yes — TasksView with pending/completed | Match |
| Drag-to-reschedule on calendar | Yes | No | Yes — FullCalendar drag support | Match |
| Work orders from estimates | Yes | No | Yes — "From Estimate" on Work Orders | Match |
| Work order kanban board | Limited | No | Yes — 4-column kanban (Pending/Scheduled/In Progress/Completed) | Better |
| **Storm Data & Maps** |||||
| Hail/wind/tornado maps | No | Yes (core) | Yes — NOAA MESH + NWS + SPC data, free | Better |
| Real-time storm alerts | No | Yes ($) | Yes — Storm Alerts in Settings, free | Better |
| Property data within swaths | No | Yes ($) | Yes — County + FEMA records overlay | Match |
| Weather history reports | No | Yes ($) | Yes — per-property storm history + PDF download | Match |
| Impacted asset alerts | No | Yes ($) | Yes — automatic notifications when leads re-impacted | Match |
| FEMA property data | No | Yes ($) | Yes — on-demand FEMA NSI lookup | Match |
| Storm severity indicators | No | Yes | Yes — hail size color graduation on map | Match |
| Historical storm data | No | Yes ($) | Yes — 30-day rolling window from NOAA | Worse |
| **Canvassing** |||||
| GPS-verified pin dropping | No | Yes ($) | Yes — CanvassingMode with 50ft GPS verification | Match |
| Outcome tracking (not home, interested, etc.) | No | Yes | Yes — color-coded outcome buttons | Match |
| Pin-to-lead conversion | No | Yes | Yes — "Convert to Lead" on interested pins | Match |
| Daily canvassing stats | No | Yes | Yes — doors/interested/scheduled counters | Match |
| Canvassing region assignment | No | Yes ($) | No | Missing |
| **Automation & Reporting** |||||
| Workflow automations | Yes (10 on Growing, unlimited on Established) | No | Yes — unlimited, free | Better |
| Reports dashboard | Yes (Insights module) | Dashboard | Yes — 6 report types with recharts | Match |
| Revenue tracking | Yes | No | Yes — revenue report by month | Match |
| Rep performance leaderboard | Yes | No | Yes — Dashboard + Reports leaderboard | Match |
| Conversion funnel | Yes | No | Yes — Dashboard + Reports conversion | Match |
| Profit tracker per job | Yes | No | No — no per-job cost tracking yet | Missing |
| **Communication** |||||
| Built-in texting (SMS) | Yes ($49-249/mo) | No | No | Missing |
| Email integration | Yes | No | No (email via automations only) | Worse |
| Automated review requests | Yes | No | No | Missing |
| Caller ID | Yes | No | No | Missing |
| **Other** |||||
| Photo annotation/reports | Yes (CompanyCam integration) | No | No — doc upload only, no annotation | Worse |
| Aerial roof measurements | Yes (EagleView integration) | No | No | Missing |
| Material ordering | Yes (QXO, SRS) | No | Materials page exists but no supplier integration | Worse |
| Subcontractor management | Yes | No | No | Missing |
| Mobile app (iOS/Android) | Yes (4.8 star) | Yes | No — web only (responsive planned) | Missing |
| AI assistant | Yes (AssistAI, Scout) | No | No | Missing |
| Document management | Yes | No | Yes — upload docs to leads | Match |
| Team management | Yes | No | Yes — Settings > Team tab | Match |
| Multi-tenant isolation | Yes | N/A | Yes — full tenant scoping | Match |

---

## Summary

### Where StormPipe is BETTER than competitors:
1. **All-in-one platform** — CRM + Storm Data in one app (competitors require JobNimbus + HailTrace = 2+ subscriptions)
2. **Free storm data** — NOAA/NWS/SPC data at zero cost vs HailTrace's paid subscriptions
3. **Unlimited automations** — free, vs JobNimbus limiting to 10 on $225/mo plan
4. **Built-in estimate builder** — free, vs JobNimbus requiring SumoQuote addon
5. **Custom fields** — free, vs JobNimbus requiring $550/mo Established plan
6. **Work order kanban** — more visual than JobNimbus's basic work orders
7. **No per-user fees** — flat pricing vs JobNimbus's $25-75/user/month and RoofLink's $120/user/month
8. **Contracts + e-signing** — built in, vs competitors requiring separate tools
9. **Expense tracking** — per-job cost tracking built in
10. **Drip sequences** — automated follow-up included free, vs Rooftops.ai charging $199/mo for AI automation

### Where StormPipe is WORSE or MISSING:
1. **No QuickBooks sync** — critical for accounting workflows
2. **No SMS/texting** — JobNimbus charges $49-249/mo for this
3. **No mobile app** — both competitors have native apps
4. **No photo annotation** — JobNimbus integrates CompanyCam
5. **No aerial measurements** — JobNimbus integrates EagleView (paid service)
6. **Limited historical storm data** — HailTrace has 10+ years, we have 30-day rolling window
7. **No per-job profit tracking** — JobNimbus has Profit Tracker
8. **No review request automation** — JobNimbus automates Google/Yelp review requests
9. **No subcontractor management** — JobNimbus tracks subs
10. **No canvassing region assignment** — HailTrace supports territory management

### Features that CANNOT be built for free:
- SMS texting (requires Twilio/similar — ~$0.0075/msg)
- Aerial roof measurements (EagleView is paid)
- Mobile native apps (development cost, not API cost)
- Advanced AI assistant (requires LLM API costs)

### Features that CAN be built for free:
- QuickBooks sync (QuickBooks API has free tier for small apps)
- Photo annotation (canvas-based, client-side only)
- Historical storm data expansion (NOAA bulk CSV is free)
- Per-job profit tracking (just DB columns + UI)
- Review request links (mailto/sms link generation, not sending)
- Canvassing region assignment (PostGIS polygon drawing)
- Subcontractor management (simple CRUD)

---

## Pricing Analysis

### JobNimbus Pricing (2026)

| Plan | Base | Per Admin | Per Sales | Per Field | Per Sub |
|---|---|---|---|---|---|
| Growing | $225/mo | $75/mo | $55/mo | $30/mo | $20/mo |
| Established | $550/mo | $75/mo | $55/mo | $30/mo | $20/mo |

**Add-ons:**
- Engage Texting: $49-249/mo
- SumoQuote (estimates): additional cost
- Marketing Bundle: additional cost

**Total cost by company size:**

| Size | Plan | Base | Users | Texting | Monthly | Annual |
|---|---|---|---|---|---|---|
| Solo | Growing | $225 | $75 (1 admin) | $49 | **$349** | **$4,188** |
| 5-person | Growing | $225 | $250 (avg $50/user) | $149 | **$624** | **$7,488** |
| 10-person | Established | $550 | $500 (avg $50/user) | $149 | **$1,199** | **$14,388** |

### HailTrace Pricing (2026)

HailTrace does not publish exact pricing. Based on research:
- **Maps Only:** ~$83-166/mo ($999-1,999/year based on comparable)
- **Maps & Data:** ~$150-250/mo (estimated, includes residential data)
- **Enterprise:** ~$300+/mo (includes canvassing + commercial data)
- Pricing varies by coverage area (pay per state/region)

### RoofLink Pricing (2026)

- **$120/user/month** flat rate — all features included, no tiers
- Volume discount available (~$100/user)
- No per-measurement costs

| Company Size | Users | Monthly | Annual |
|---|---|---|---|
| Solo | 1 | **$120** | **$1,440** |
| 5-person | 5 | **$600** | **$7,200** |
| 10-person | 10 | **$1,200** | **$14,400** |

### Rooftops.ai Pricing (2026)

- **Free tier:** 1 free roof report
- **AI Employees:** $199/mo (coming soon) — automated follow-up, content, social media
- **White-glove consulting:** $5,000 one-time (5-week setup + 6 months premium)
- Regular subscription pricing not publicly disclosed

### Combined Competitor Cost (JobNimbus + HailTrace)

| Company Size | JobNimbus | HailTrace | **Total Monthly** | **Total Annual** |
|---|---|---|---|---|
| Solo operator | $349 | $125 | **$474** | **$5,688** |
| 5-person team | $624 | $200 | **$824** | **$9,888** |
| 10-person team | $1,199 | $300 | **$1,499** | **$17,988** |

### StormPipe Recommended Pricing

**Goal:** Match or exceed both competitors' combined features at 70-85% savings.

**Infrastructure costs:** Near-zero (Neon free tier DB, NOAA/NWS free APIs, Vercel/Railway free tier hosting possible)

| Tier | Price | Includes | Target |
|---|---|---|---|
| **Starter** | **$29/mo** | 3 users, CRM pipeline, estimates, invoices, storm map, 5 automations, basic reports | Solo operators |
| **Professional** | **$79/mo** | 10 users, everything in Starter + unlimited automations, canvassing, work orders, calendar, custom fields, PDF reports, financing integration | Small teams (3-10 people) |
| **Enterprise** | **$149/mo** | Unlimited users, everything in Professional + priority support, API access, white-label options | Large operations |

**Savings vs competitors:**

| Company Size | Competitors | StormPipe | **Monthly Savings** | **Annual Savings** | **% Saved** |
|---|---|---|---|---|---|
| Solo | $474/mo | $29/mo | **$445** | **$5,340** | **94%** |
| 5-person | $824/mo | $79/mo | **$745** | **$8,940** | **90%** |
| 10-person | $1,499/mo | $149/mo | **$1,350** | **$16,200** | **90%** |

**Key differentiators for marketing:**
1. "One platform, not two" — CRM + storm data in one app
2. "No per-user fees" — flat monthly price, add your whole team
3. "90% cheaper than JobNimbus + HailTrace combined"
4. "Free storm data powered by NOAA" — same government data, zero markup
5. "Unlimited automations at every tier" — vs JobNimbus's 10-automation limit on $225/mo plan
