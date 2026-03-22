# Competitor Gap Analysis: StormLeads vs JobNimbus + HailTrace

**Date:** 2026-03-22
**Analyst:** Claude (automated overnight audit)

---

## Feature Comparison Matrix

| Feature | JobNimbus | HailTrace | StormLeads | Status |
|---------|-----------|-----------|------------|--------|
| **CRM & Pipeline** |
| Customizable sales pipeline | Yes | No | Yes (drag-and-drop kanban) | Match |
| Lead/contact management | Yes | No | Yes (full CRUD, filters, bulk CSV export) | Match |
| Lead detail with full history | Yes | No | Yes (activities, documents, custom fields) | Match |
| Lead source tracking | Yes | No | Yes (storm, referral, door knock, etc.) | Match |
| Priority levels | Yes | No | Yes (hot/warm/cold) | Match |
| Bulk actions on leads | Yes | No | Yes (checkbox select, bulk stage change) | Match |
| **Estimating** |
| Estimate builder with line items | Yes (SumoQuote add-on $$$) | No | Yes (built-in, free) | Better |
| Estimate templates | Yes | No | Yes | Match |
| Customer-facing estimate page | Yes | No | Yes (with e-signature canvas) | Match |
| E-signatures | Yes (add-on) | No | Yes (built-in canvas) | Better |
| Estimate PDF export | Yes | No | Yes (pdfmake) | Match |
| **Invoicing** |
| Invoice creation | Yes | No | Yes | Match |
| Create invoice from estimate | Yes | No | Yes (one-click conversion) | Match |
| Payment tracking | Yes | No | Yes (partial/full payment recording) | Match |
| Payment processing (Stripe/CC) | Yes (built-in) | No | Yes (Stripe integration) | Match |
| Overdue tracking | Yes | No | Yes (auto-status) | Match |
| **Scheduling & Tasks** |
| Calendar view | Yes | No | Yes (FullCalendar - month/week/day/list) | Match |
| Task management | Yes | No | Yes (create, assign, filter, complete) | Match |
| Drag-to-reschedule | Yes | No | Yes | Match |
| **Work Orders** |
| Work order creation | Yes | No | Yes (kanban board) | Match |
| Create from estimate | Yes | No | Yes | Match |
| Crew assignment | Yes | No | Yes | Match |
| Scheduling (date + time) | Yes | No | Yes | Match |
| **Automation** |
| Workflow rules | Yes | No | Yes (trigger → action engine) | Match |
| Stage change triggers | Yes | No | Yes | Match |
| Auto-create tasks | Yes | No | Yes | Match |
| Auto-assign reps | Yes | No | Yes | Match |
| Auto-notify | Yes | No | Yes | Match |
| **Reporting** |
| Revenue reports | Yes | No | Yes (bar charts by month) | Match |
| Pipeline reports | Yes | No | Yes (leads per stage) | Match |
| Conversion reports | Yes | No | Yes (by source) | Match |
| Rep performance leaderboard | Yes | No | Yes (table + metrics) | Match |
| Stage duration analytics | Yes | No | Yes (avg days per stage) | Match |
| Custom date range filtering | Yes | No | Yes (presets + custom) | Match |
| **Documents** |
| Document upload to leads | Yes | No | Yes | Match |
| Photo documentation | Yes | No | Yes (via document upload) | Match |
| **Team Management** |
| User roles & permissions | Yes | No | Yes (admin/manager/rep/viewer) | Match |
| Team member management | Yes | No | Yes (invite, role change) | Match |
| Team leaderboard | Yes | No | Yes | Match |
| **Custom Fields** |
| Custom field definitions | Yes | No | Yes (text/number/date/select/boolean) | Match |
| Tenant-scoped fields | Yes | No | Yes | Match |
| **Storm/Weather** |
| Storm/hail maps | No | Yes | Yes (NOAA MESH + SPC + NWS) | Match |
| Hail swath visualization | No | Yes | Yes (severity-graded swaths) | Match |
| Property data within swaths | No | Yes | Yes (FEMA NSI + county records) | Match |
| Weather history reports | No | Yes | Yes (on-demand NOAA lookup + PDF) | Match |
| Storm severity indicators | No | Yes | Yes (hail size + wind speed legends) | Match |
| Impacted asset alerts | No | Yes | Yes (auto-notify when leads hit by new storms) | Match |
| Real-time storm tracking | No | Yes | Yes (MRMS radar, NWS alerts, SPC reports) | Better |
| Thunderstorm layer | No | Partial | Yes (NWS thunderstorm warnings overlay) | Better |
| **Canvassing** |
| GPS-verified pin dropping | No | Yes | Yes (browser geolocation) | Match |
| Outcome tracking per door | No | Yes | Yes (6 outcome types) | Match |
| Pin-to-lead conversion | No | Yes | Yes (one-click) | Match |
| Daily canvassing stats | No | Yes | Yes (doors/interested/scheduled) | Match |
| **Financing** |
| Customer financing options | Yes (add-on) | No | Yes (Hearth integration) | Match |
| Financing in estimates | Yes (add-on) | No | Yes (built-in toggle) | Better |
| **Notifications** |
| In-app notifications | Yes | Yes | Yes (bell icon, unread count) | Match |
| Storm alerts | No | Yes | Yes (configurable by location) | Match |
| **Search** |
| Global search (Cmd+K) | Yes | No | Yes | Match |
| **Mobile** |
| Mobile app | Yes (iOS/Android) | Yes (iOS/Android) | Web-only (responsive) | Worse |
| **Integrations** |
| QuickBooks | Yes | No | Not yet | Missing |
| Google Calendar sync | Yes | No | Not yet | Missing |
| Zapier/webhooks | Yes | No | Webhooks (Hearth) | Partial |
| Text/SMS messaging | Yes (Engage add-on $$) | No | Not yet | Missing |
| Email campaigns | Yes | No | Not yet | Missing |
| Aerial roof measurement | Yes (EagleView integration) | No | Yes (roof drawing tool) | Match |
| Material ordering | Yes (ABC Supply, Beacon, SRS) | No | Yes (materials view) | Partial |
| Subcontractor management | Yes (portal for subs) | No | Not yet | Missing |
| Video upload | Yes | No | Not yet | Missing |

---

## Where StormLeads Is Better

1. **All-in-one platform** — Competitors require TWO subscriptions (JobNimbus CRM + HailTrace storm data). StormLeads combines both in one app.
2. **Built-in estimating with e-signatures** — JobNimbus charges extra for SumoQuote. We include it free.
3. **Real-time storm data** — We ingest NOAA MESH radar, SPC reports, and NWS alerts automatically. HailTrace data is delayed.
4. **Built-in financing** — Hearth integration is included. JobNimbus charges for financing add-ons.
5. **No per-feature add-on costs** — Everything is included. JobNimbus nickels-and-dimes with Engage, SumoQuote, etc.
6. **Infrastructure cost advantage** — Built on Neon free tier + free public APIs. Near-zero marginal cost per user.

## Where StormLeads Is Worse or Missing

1. **No native mobile app** — Both competitors have iOS/Android apps. We're web-only (responsive). Mobile app is critical for field reps doing canvassing, inspections, and photo documentation.
2. **No QuickBooks integration** — Many roofers use QuickBooks for accounting. This is table stakes for a CRM.
3. **No SMS/text messaging** — JobNimbus Engage allows texting customers directly from the CRM. This is high-value for follow-ups.
4. **No email campaigns** — No built-in email marketing for drip campaigns or bulk outreach.
5. **No Google Calendar sync** — Calendar exists but doesn't sync with external calendars.
6. **No Zapier integration** — Limits ability to connect with other tools in the roofer's stack.

---

## Pricing Analysis

### JobNimbus Pricing (as of 2025-2026)

**Note:** JobNimbus does NOT publish pricing. They require a sales call. Figures below from third-party research and user reviews.

**Three-layer pricing model:**

**Layer 1 — Base Platform Fee:**

| Plan | Monthly Cost | Key Limits |
|------|-------------|------------|
| Growing | ~$225/mo | 10 automations, 5 integrations, no API access |
| Established | ~$550/mo | Unlimited automations, integrations, API access |

**Layer 2 — Per-User Fees (every team member needs a paid seat):**

| Tier | Cost/User/Month |
|------|----------------|
| Basic | ~$25/user/mo |
| Standard | ~$40/user/mo |
| Full Access | ~$65-75/user/mo |

**Layer 3 — Add-Ons:**
- Engage Texting (Basic): $49/mo + $20 setup
- Engage Texting (Standard): $149/mo + $20 setup
- Engage Texting (Full): $249/mo + $20 setup
- CompanyCam: ~$19/user/mo (separate subscription)
- EagleView Reports: per-report fee
- Marketing Bundle: custom pricing
- Payment processing: card + ACH transaction fees

**Real-world total costs (from reviews/research):**
- Solo operator: ~$300/mo minimum (base + 1 user)
- 5-person team (Growing): ~$749/mo ($225 base + 5×$75 users + $149 texting)
- 5-person team (Established): ~$1,074/mo ($550 base + 5×$75 users + $149 texting)
- 10-person team (Established): ~$1,549-2,000/mo ($550 base + 10×$75 users + $249 texting + add-ons)

**Common pricing complaints from reviews:**
1. Hidden/opaque pricing requires sales call
2. Three-layer model is confusing and hard to budget
3. Every seat costs money — even field techs and subcontractors
4. Texting (a core feature for roofers) is a $49-249/mo add-on
5. Growing plan's 10-automation and 5-integration limits force upgrade to $550/mo Established
6. Implementation/onboarding fees: $500-5,000 one-time

### HailTrace Pricing (as of 2025-2026)

| Plan | Price | Includes |
|------|-------|----------|
| Basic | ~$49-79/mo | Hail maps, basic alerts |
| Pro | ~$99-149/mo | All storm data, canvassing, property data |
| Enterprise | Custom | Multi-state, bulk data, API access |

**Typical total costs:**
- Solo operator: ~$79/mo
- 5-person team: ~$99-149/mo (team plan)
- 10-person team: ~$149-249/mo

### Combined Competitor Cost (JobNimbus + HailTrace)

| Company Size | JobNimbus | HailTrace | Total/mo | Annual |
|-------------|-----------|-----------|----------|--------|
| Solo operator | $300 | $79 | **$379/mo** | $4,548/yr |
| 5-person team | $749 | $149 | **$898/mo** | $10,776/yr |
| 10-person team | $1,549 | $249 | **$1,798/mo** | $21,576/yr |

---

## StormLeads Pricing Recommendation

**Strategy:** Significantly undercut competitors by leveraging near-zero infrastructure costs. Position as the affordable all-in-one alternative.

### Proposed Tiers

| Tier | Price | Users | Features |
|------|-------|-------|----------|
| **Starter** | **$49/mo** | 1 user | Full CRM, storm maps, estimating, invoicing, canvassing, reports. Everything included. |
| **Team** | **$99/mo** | Up to 5 users | Everything in Starter + team management, automations, work orders, calendar, custom fields. |
| **Business** | **$199/mo** | Up to 15 users | Everything in Team + priority support, advanced reporting, API access. |
| **Additional users** | **$15/user/mo** | Beyond tier limit | Add users to any plan. |

### Savings vs Competitors

| Company Size | Competitors (JN + HT) | StormLeads | Annual Savings |
|-------------|----------------------|------------|----------------|
| Solo operator | $379/mo | $49/mo | **$3,960/year** (87% savings) |
| 5-person team | $898/mo | $99/mo | **$9,588/year** (89% savings) |
| 10-person team | $1,798/mo | $199/mo | **$19,188/year** (89% savings) |

### Why This Works

1. **Near-zero marginal cost:** Neon free tier DB, free NOAA/FEMA APIs, no per-message costs.
2. **No add-on nickel-and-diming:** Everything included in every tier. Estimating, e-signatures, financing, automations — all free.
3. **Massive value proposition:** "Get everything JobNimbus + HailTrace offer for 1/5 the price."
4. **Land-and-expand:** Low entry price attracts solo operators who grow into team plans.

---

## Action Items

### High Priority (build next)
1. **QuickBooks integration** — Free API available. Connect invoices and payments.
2. **Google Calendar sync** — OAuth2 Calendar API. Sync tasks/appointments.
3. **SMS/texting** — Twilio or free alternatives (Signal API). Critical for field follow-ups.

### Medium Priority
4. **Email templates/campaigns** — Nodemailer is already set up. Add template builder + scheduled sends.
5. **Zapier webhooks** — Expose key events (lead created, stage changed, estimate sent) as webhook endpoints.
6. **Progressive Web App (PWA)** — Add service worker + manifest for installable mobile experience without native app dev cost.

### Low Priority / Future
7. **Native mobile app** — React Native or Capacitor wrapper. Most expensive but highest impact for field reps.
8. **AI features** — Auto-generate estimates from roof measurements, smart lead scoring, chatbot.
