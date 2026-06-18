# StormLeads — Technical Reference

A storm-restoration CRM (roofing / hail-damage lead generation and job management) built as a
multi-tenant SaaS. It ingests live severe-weather data, matches it to individual properties,
and runs the full contractor sales-to-cash workflow (leads → estimates → contracts → work
orders → invoices → payments).

> Scope note: this document describes the code as it exists in the repo. No secrets, keys, or
> `.env` values are included — only the *names* of environment variables.

---

## 1. Stack

| Layer | Technology |
|---|---|
| **Language** | JavaScript (ES modules, `"type": "module"`), JSX |
| **Runtime** | Node.js |
| **Repo layout** | npm workspaces monorepo: `client/` + `server/` |
| **Backend framework** | Express 5.1 |
| **Frontend framework** | React 19.2 + React Router 7.5, built with Vite 7 |
| **Styling** | Tailwind CSS 4 (`@tailwindcss/vite`) + custom "Liquid Glass" (iOS-26-style) CSS, dark-mode first, oklch color space |
| **Client data layer** | TanStack React Query 5 + axios |
| **Database** | PostgreSQL with the **PostGIS** spatial extension |
| **DB access** | `pg` (node-postgres) with a shared connection pool (`db/pool.js`); raw parameterized SQL, no ORM |
| **Migrations** | Hand-rolled runner (`db/migrate.js`) applying **49 versioned SQL files** in `server/src/db/migrations/` (`001_extensions.sql` … `048_…`) |
| **Background jobs** | `node-cron` scheduler (`ingestion/scheduler.js`) |
| **Logging** | `pino` (+ `pino-pretty` in dev) |
| **Auth** | `jsonwebtoken` + `bcryptjs` |
| **Validation** | `zod` |
| **Testing** | Playwright (E2E + nightly UI audit) |

**Hosting / deployment shape.** A single Node process serves everything: in production
`app.js` serves the built React SPA from `client/dist` as static files with an
`index.html` fallback, and mounts the API under `/api` on the same origin (`server/src/app.js:43-52`).
That's why production CORS is set to same-origin (`app.js:14-17`). The process starts the API
listener and the cron scheduler together (`server/src/index.js`). The root `start` script runs
migrations and a seed before booting (`package.json:15`). The database is a hosted Postgres
(Neon free tier per project notes); connection is via a single `DATABASE_URL`. There is **no
CI/CD config or container/orchestration manifest** in the repo — deployment is a plain Node
host.

---

## 2. Third-Party Integrations & External APIs

This app talks to an unusually large number of external services. They fall into three buckets:
**paid/keyed commercial APIs**, **free public government/data APIs** (the storm-data backbone),
and **infrastructure** (email, payments).

### Commercial / keyed services

| Service | What it does in the app | Auth method (env var names) |
|---|---|---|
| **Stripe** + **Stripe Connect** | All money movement: tenant subscription billing; customer card/ACH payments on public estimates; Stripe **Connect** marketplace onboarding so each contractor (tenant) gets paid directly with an application fee; batch billing for skip-trace and roof-measurement usage. | Server secret key `STRIPE_SECRET_KEY`; client publishable key `VITE_STRIPE_PUBLISHABLE_KEY`; webhook HMAC secret `STRIPE_WEBHOOK_SECRET`. (`routes/payments.js`, `services/stripeService.js`) |
| **Tracerfy** (skip trace) | Reverse skip-trace: turns a property address into homeowner name / phone / email for canvassing lists. Submitted as a CSV job; results returned via webhook. Billed per record ($0.15) and tracked for invoicing. | Bearer token `TRACERFY_API_KEY`, base `TRACERFY_API_BASE`. Results posted back to an **unauthenticated** webhook (validates `tenant_id` in body). (`services/skipTraceService.js`, `routes/skipTrace.js`, `routes/webhook.js`) |
| **Hearth** (financing) | Consumer financing for roofing jobs: fetches loan plans (term/APR/fees), creates a financing application link for the homeowner, and receives approval/funding status. | Per-tenant merchant API key, **encrypted at rest** with `ENCRYPTION_KEY`; base `HEARTH_API_URL`. Webhooks verified by **HMAC-SHA256** over the raw body (`x-hearth-signature`), timing-safe compare. (`services/financing/adapters/hearth.js`, `routes/hearthWebhook.js`) |
| **Google Solar API** | Roof measurement — pulls roof area, pitch, and segment/orientation data for a property (used as the roof-measurement billing feature). | Server key `GOOGLE_SOLAR_API_KEY`. (`services/roofMeasurementService.js`) |
| **Google Maps JS** (Places, Street View, geocoding) | Address autocomplete on lead entry, Street View imagery on the lead detail page, client-side geocoding/map UI. | Browser key `VITE_GOOGLE_MAPS_KEY`. (`client/src/lib/googleMaps.js`, `AddressSearch.jsx`, `LeadDetail.jsx`) |
| **Mapbox GL** | The primary interactive map: storm-swath rendering, property markers/clustering, roof-drawing tool. | Public token `VITE_MAPBOX_TOKEN`. (`StormMap.jsx`, `Dashboard.jsx`, `RoofDrawingTool.jsx`) |
| **SMTP email** (Nodemailer) | Outbound email: storm alerts, estimate/notification emails, overdue-invoice reminders, drip-campaign steps. Provider-agnostic SMTP (SendGrid/Mailgun/Gmail/self-hosted). | `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`. |

### Free public data APIs (the storm-data backbone — no auth required)

| Service | What it provides |
|---|---|
| **NOAA MRMS** (Multi-Radar Multi-Sensor, MESH) | Gridded radar hail-size estimates. Downloaded as **GRIB2** from a public NOAA S3 bucket, parsed, and turned into contour polygons (the colored hail swaths). (`ingestion/mrmsIngester.js`) |
| **NOAA/NWS Alerts** (`api.weather.gov`) | Live tornado/hail/wind warning polygons; ingested every few minutes. (`ingestion/nwsIngester.js`) |
| **NOAA SPC** (Storm Prediction Center) | Storm-spotter hail and wind reports (CSV), buffered into polygons. (`ingestion/spcIngester.js`) |
| **NOAA HRRR** (via NOMADS) | Atmospheric wind profile at multiple altitudes — feeds the hail wind-drift correction. (`services/windDriftService.js`) |
| **NOAA SWDI** (Severe Weather Data Inventory, `ncei.noaa.gov`) | Historical hail/tornado/wind for a location — used in lead scoring and the hail history heatmap. (`services/stormHistoryService.js`) |
| **FEMA NSI** (National Structure Inventory) | Building attributes per structure: square footage, year built, replacement value, foundation, stories, occupancy. (`ingestion/femaIngester.js`) |
| **OpenFEMA** (Disaster Declarations) | County-level disaster history → a risk score used in lead scoring. (`services/disasterDeclarationService.js`) |
| **FEMA Housing Assistance** | Post-disaster damage/claim density by ZIP. (`services/femaHousingService.js`) |
| **US Census Geocoder** | Free server-side address↔coordinate geocoding (avoids Google quota/cost). (`services/censusGeocoderService.js`) |
| **US Census ACS** (American Community Survey) | Demographics by tract: median year built, owner-occupancy rate — feeds lead scoring. (`services/censusAcsService.js`) |
| **OpenStreetMap Nominatim** | Fallback reverse-geocoder when Census lacks street-level data. (`censusGeocoderService.js`) |
| **OSRM** (Open Source Routing Machine) | Canvassing route optimization (traveling-salesman ordering of door-knock stops) and A→B drive times. (`services/routeOptimizerService.js`) |
| **County ArcGIS GIS servers** | Per-county parcel data import (e.g., TCAD/HCAD) via configurable field maps. (`ingestion/countyImporter.js`, `tcadImporter.js`, `county_data_sources` table) |

### Notable dependency-vs-reality caveats

- **AWS S3 (`@aws-sdk/client-s3`) is a dependency but NOT wired up.** Document uploads are
  stored on **local disk** via `multer.diskStorage` to `/uploads/` (`routes/documents.js:23-24`,
  `file_url: '/uploads/...'`). The code comment literally says *"swap for S3 in production."*
  No `S3Client` is instantiated anywhere in `server/src`.
- **`@google/stitch-sdk`** appears in the root `package.json` and there are `stitch-designs/*.html`
  artifacts, but Stitch is a **design-time tool** (Google's UI generator), not a runtime integration.
- **SRS Distribution** (roofing material supplier) has a table (`material_orders`, `srs_credentials`)
  and service scaffolding for material ordering, keyed per-tenant.

### Client-side libraries doing heavy lifting (not external services, but worth naming)
`@turf/turf` (geospatial geometry ops), `d3-contour` (contour polygon generation), `pako`
(gzip inflate for GRIB2), `supercluster` (map marker clustering), `@dnd-kit` (kanban drag-drop),
`@fullcalendar/*` (calendar/scheduling), `recharts` (dashboard charts), `pdfmake` (estimate
PDFs), `sharp` (image processing).

---

## 3. Auth Model

### Authentication
- **Method:** stateless **JWT** with a refresh-token rotation scheme.
- **Login:** email + tenant slug + password. Passwords hashed with **bcrypt** (10 rounds).
  (`services/authService.js`)
- **Tokens:** short-lived **access token** (15 min, signed with `JWT_SECRET`) carrying
  `{ id, tenantId, email, role }`, plus a long-lived **refresh token** (7 days, signed with
  `JWT_REFRESH_SECRET`). The refresh token is **SHA-256 hashed before being stored** in
  `users.refresh_token` — the plaintext is never persisted.
- **Verification:** `middleware/authenticate.js` pulls the `Bearer` token, verifies it, and
  populates `req.user`.
- **Client storage:** access + refresh tokens live in `localStorage`. An axios **request
  interceptor** attaches `Authorization: Bearer …`; a **response interceptor** catches 401s,
  calls `/auth/refresh` (with a single-flight queue so concurrent 401s don't stampede), updates
  storage, and retries — or redirects to login on failure. (`client/src/api/client.js`)

### Authorization
- **Multi-tenancy (primary boundary):** `middleware/tenantScope.js` reads `tenantId` from the
  JWT and sets `req.tenantId`. Every tenant-scoped route runs `authenticate → tenantScope`, and
  every query is filtered `WHERE tenant_id = $1`. Isolation is enforced in the **application
  layer + NOT-NULL `tenant_id` FKs**, not Postgres row-level security.
- **Role-based access:** `middleware/authorize(...roles)` gates routes by `req.user.role`. Roles:
  `super_admin`, `admin`, `manager`, `sales_rep`. Platform-admin routes (`/api/admin`) require
  `super_admin` and intentionally **skip** `tenantScope` (they operate across tenants).
- **Rate limiting:** `express-rate-limit` on auth endpoints only — login 10/15 min, register
  5/hr, refresh 30/15 min. (`routes/auth.js`)
- **Hardening:** `helmet` (CSP disabled), `compression`, production same-origin CORS with
  credentials, and a JSON body-parser wrapper that returns sanitized 400s on malformed bodies
  (so it never echoes the payload back). (`app.js`)

### Auth method per integration (summary)
| Integration | Auth |
|---|---|
| Stripe API | Secret API key |
| Stripe webhook | HMAC signature (`STRIPE_WEBHOOK_SECRET`) |
| Hearth API | Per-tenant API key, encrypted at rest |
| Hearth webhook | HMAC-SHA256 signature, timing-safe compare |
| Tracerfy API | Bearer API key |
| Tracerfy webhook | **None** (validates `tenant_id` in body) |
| Google Solar / Maps | API keys |
| Mapbox | Public token |
| NOAA / FEMA / Census / OSRM / Nominatim | None (public) |
| SMTP | Username/password |
| **Public estimate / contract / client-status pages** | **Unguessable opaque token in the URL** (`public_token` / `token`), looked up directly — no login, no JWT. Used for customer estimate viewing, e-signature acceptance, and job-status tracking. |

---

## 4. Data Model

**~55 tables** managed across 49 migrations. Postgres + PostGIS. Hard multi-tenancy: virtually
every business table carries a `tenant_id UUID NOT NULL` FK to `tenants` with `ON DELETE CASCADE`.

### Core entity graph
```
tenants ──┬─ users (role enum; refresh_token)
          ├─ properties ── storm_events (spatial match)
          └─ leads ──┬─ contacts
                     ├─ activities      (timeline: call/email/text/door_knock/…)
                     ├─ tasks
                     ├─ outreach_log
                     ├─ estimates ──┬─ invoices
                     │              ├─ contracts
                     │              ├─ payments        (Stripe)
                     │              └─ financing_applications (Hearth)
                     ├─ work_orders ──┬─ work_order_milestones
                     │                └─ work_order_subcontractors ── subcontractors
                     └─ documents
```

### Key entities
- **tenants** — the SaaS account/company. Holds `service_area` polygon, Stripe customer/account/
  subscription IDs, JSONB `branding`, subscription tier/status.
- **users** — per-tenant; `(tenant_id, email)` unique; role enum.
- **properties** — a physical building. `location GEOMETRY(POINT, 4326)`; unique
  `county_parcel_id`; roof measurements; ~15 FEMA NSI columns (sqft, year built, replacement
  value, foundation, etc.); assessed value.
- **storm_events** — a hail/wind/tornado event. `source` enum (`mrms_mesh`/`nws_alert`/
  `spc_report`), `geom` (the swath/path), `bbox`, **`drift_corrected_geom`** (wind-adjusted
  polygon), `hail_size_max_in`, `wind_speed_max_mph`, raw API payload as JSONB.
- **leads** — the central CRM record. `stage` enum (`new → contacted → appt_set → inspected →
  estimate_sent → negotiating → sold → in_production → on_hold / lost`), `priority` enum
  (`hot`/`warm`/`cold`), soft delete (`deleted_at`), `lead_score` + `lead_score_factors` JSONB,
  `tags TEXT[]`, `custom_fields` JSONB.
- **estimates** — `line_items` JSONB, financials, `public_token` for the customer page,
  `signature_data` (base64 e-signature), `insurance_details` JSONB, optional `upgrades`, financing
  toggle.
- Operational layer: **work_orders / milestones / subcontractors**, **expenses**,
  **material_orders** (SRS), **invoices**, **payments**.
- Growth/automation layer: **drip_sequences / steps / enrollments**, **prospect_lists**,
  **content_library**, **automations**, **notifications / preferences**, **alert_configs /
  storm_alerts**.
- Field layer: **canvass_pins** (point geom + outcome enum), **canvass_territories** (polygon geom),
  **client_status_tokens**.
- Config/billing: **subscription_plans**, **custom_field_definitions**, **pipeline_stages**,
  **financing_lenders/plans/applications**, **skip_trace_usage / invoices / config**,
  **roof_measurement_usage**, **county_data_sources**, **drift_calibrations**.

### Non-obvious / technically interesting bits
- **Spatial joins are the product's core.** ~12 PostGIS geometry columns across 8 tables, ~10
  GIST indexes. The fundamental query is "which properties fall inside this storm swath" —
  `ST_Intersects(property.location, storm_event.geom)`, ordered by `ST_Distance` to the swath
  centroid. Territories and canvass pins use the same machinery (`ST_Contains`/`ST_Intersects`).
- **Wind-drift correction is stored as a second geometry.** `storm_events.drift_corrected_geom`
  holds a translated copy of the swath (radar sees hail aloft; it lands offset downwind), with
  `drift_vector_m` JSONB metadata and a `drift_calibrations` table capturing predicted-vs-actual
  offsets for tuning.
- **County import is schema-flexible.** `county_data_sources.field_map` (JSONB) maps each
  county's ArcGIS field names onto StormLeads property columns, so new counties are onboarded by
  config, not code.
- **Heavy JSONB use (~24 columns)** for things that vary per tenant/record: line items, branding,
  insurance details, custom fields, score factors, raw API responses.
- **10 enum types + 14+ check constraints** lock down the controlled vocabularies (lead stage,
  priority, invoice/payment/work-order status, etc.). Note: lead `priority` is `hot/warm/cold` —
  not low/med/high.
- **Computed/denormalized values:** `lead_score` (recomputed by a scheduled service from 7
  weighted factors), `pin_count`, `property_count`, plus `updated_at` auto-maintained by triggers
  on the hot tables. A `lead_summary_view` denormalizes leads + contacts + property + storm for
  dashboards.

---

## 5. The Hardest Problems Solved

### 1. Turning raw NOAA radar files into map-ready hail swaths (GRIB2 → contours)
`ingestion/gribParser.js`, `contourBuilder.js`, `mrmsIngester.js`. The MRMS hail product ships
as binary **GRIB2** on a public NOAA bucket. The code downloads it, **gzip-inflates with pako**,
and hand-parses the GRIB2 sections (grid definition, data-packing template, packed values),
reconstructing the Float32 grid with the GRIB unpacking formula `Y = R + (X·2^E)/10^D`. The grid
is fed to **d3-contour** to produce iso-polygons at hail thresholds (0.75″–3″), pixel coords are
projected to lat/lon (handling NOAA's 0–360 longitude), polygons are simplified with turf and
clipped to bounds via `ST_Intersection` before insert. The payoff is the multi-colored,
severity-graded hail swath layer — built from scratch with no GRIB library.

### 2. Hail wind-drift correction (a small ballistics simulation)
`services/windDriftService.js`. Radar detects hail ~5.5 km up, but it drifts downwind before
landing, so the radar swath is offset from actual roof damage. The service computes hailstone
**terminal velocity** from drag (`v_t = √(2mg / ρ·A·Cd)`), pulls a **HRRR wind profile** at 14
pressure levels (with a seasonal climatological fallback if NOMADS is down), and steps the stone
down layer by layer accumulating displacement (`wind · layer_height / v_t`). The resulting vector
is converted to degrees and applied with `ST_Translate` to produce `drift_corrected_geom`. A
calibration table feeds real damage locations back to tune it.

### 3. Rendering ~100k properties across dozens of swaths without freezing the browser
`client/src/lib/propertyCache.js`, `StormMap.jsx`, `server/services/propertyService.js`. The
viewport is split into ~0.05° tiles so only newly-visible regions are fetched; **supercluster**
spatially indexes tens of thousands of property points into zoom-dependent clusters; the server
splits responses into "light" (id + point, for dots) vs "full" (the record) to shrink payloads;
and properties are cached in **IndexedDB with a 7-day TTL** with per-tile load tracking to avoid
refetching. Net effect: incremental, responsive pan/zoom over very large point sets.

### 4. Multi-factor lead scoring fusing live + historical + demographic data
`services/leadScoringService.js`. A 0–100 score from seven weighted factors: current storm
severity, 10-yr NOAA hail history at the point, FEMA county-disaster risk, property profile
(value/age/owner-occupancy from Census ACS), event recency, engagement signals, and data
completeness. External lookups run concurrently via `Promise.allSettled` so a slow/failed source
can't block scoring. This is what drives `hot/warm/cold` prioritization.

### 5. End-to-end customer e-sign + branded PDF, no login
`client/PublicEstimate.jsx` + `routes/estimates.js`. The estimate is reachable by an opaque
`public_token` (no auth). The customer signs on an HTML5 **canvas** (mouse/touch), exported via
`toDataURL()` to base64 and stored on the estimate with signer name and `signed_at`. The server
then assembles a branded PDF with **pdfmake** (company branding, sectioned line items, the
signature embedded as a PNG), streamed back as `application/pdf`. Viewing flips status and stamps
`viewed_at`.

### 6. Multi-board drag-and-drop pipeline with optimistic persistence
`Pipeline.jsx` (+ estimates/work-orders boards). Three parallel kanban boards (Sales →
Production → Billing) over the lead-stage enum. Dragging a card does an **optimistic** UI move
and fires `updateLead({ stage })` async, reverting on error, with a JobNimbus-style slide-in
detail panel. Estimate line-items reuse the same drag pattern for reordering.

*(Honorable mention: the whole real-time ingestion mesh — see §6 — is arguably the hardest
*operational* problem: keeping multiple government feeds flowing, deduped, and spatially indexed
on cron without manual babysitting.)*

---

## 6. Scale Signals & Production Maturity

| Metric | Approx. value |
|---|---|
| Backend `.js` files (`server/src`) | ~106 |
| Frontend `.jsx` components (`client/src`) | ~51 |
| Frontend API client modules | ~20 |
| Backend service modules | ~37 |
| Ingestion/ETL modules | ~10 |
| **API route files** | **37** |
| **Total API endpoints** | **~270** (largest: `crm.js` ~51, `properties.js` ~18, `estimates.js` ~17) |
| **Database tables** | **~55** |
| **DB migrations** | **49 versioned SQL files** |
| Major frontend screens | ~18 (Dashboard, Pipeline, LeadList, LeadDetail, Calendar, Tasks, Estimates, Invoices, Expenses, Contracts, WorkOrders, Materials, Reports, Settings, Subcontractors, Admin, Canvassing, public portals) |
| Enum types / check constraints | 10 / 14+ |
| PostGIS geometry columns / GIST indexes | ~12 / ~10 |

**Maturity indicators**
- **Versioned migrations** (not seed-only) with a runner — proper schema evolution.
- **Centralized error handler** that translates Postgres SQLSTATE codes to HTTP statuses and
  sanitizes messages so internals/payloads don't leak.
- **Structured logging** (pino) and a persisted 500-error log.
- **Background scheduler** (`node-cron`) running ~8–10 recurring jobs: MRMS ingest (~30 min), NWS
  alerts (hourly), SPC reports (~2 hr), storm-area auto-import (3×/day), nightly cleanup of stale
  storms/orphan properties, plus lead scoring, drip steps, invoice reminders, and stale-lead
  notifications.
- **E2E + nightly UI audit** via Playwright with persisted auth state, plus an ongoing automated
  **QA/accessibility (axe-core) regimen** — the repo carries dated audit reports and overnight-run
  logs spanning months (the codebase notes a long streak of "converged" zero-fix backend runs).
- **Per-usage billing plumbing** (skip-trace and roof-measurement usage tables with batch Stripe
  invoicing) — real metering, not just feature flags.
- **Secrets discipline:** required env vars validated at boot; per-tenant financing keys encrypted
  at rest; webhook signature verification.
- Gaps worth noting: no CI/CD or container manifests in-repo; document storage still on local disk
  (S3 planned); tenant isolation is app-enforced rather than DB row-level security.

---

## 7. Plain-Language Glossary (the correct term for each feature)

| Feature in the app | Correct technical term | One-line explanation for a non-engineer |
|---|---|---|
| One login, many separate companies' data | **Multi-tenant SaaS architecture** | Every company's data is walled off inside one shared application. |
| Matching storms to houses | **Geospatial / spatial join (point-in-polygon)** | The system asks "which houses are inside this storm's footprint" using map geometry. |
| The colored hail areas on the map | **Contour polygon generation from a raster grid** | Radar data is converted into shaded zones by hail size. |
| Shifting the swath downwind | **Physics-based wind-drift correction** | Adjusts where hail *actually landed* vs. where radar saw it in the air. |
| Live weather feeds updating automatically | **Scheduled data ingestion / ETL pipeline** | Robots fetch and clean government weather data on a timer. |
| The drag-and-drop deal board | **Kanban pipeline** | Cards you drag between columns as a job moves through stages. |
| Hot/warm/cold ranking | **Weighted lead-scoring model** | A 0–100 score that ranks which leads are worth chasing. |
| Address → owner contact | **Skip tracing** | Looks up the homeowner's phone/email from just an address. |
| Customer signs the estimate online | **E-signature capture (canvas)** | The customer signs with finger/mouse and it's saved to the document. |
| The shareable estimate link | **Tokenized public access** | A secret link lets a customer view/sign without an account. |
| Buy-now-pay-later for roofs | **Embedded consumer financing** | Offers the homeowner a loan inside the estimate. |
| Take card/ACH payments, pay each contractor | **Marketplace payments (Stripe Connect)** | The platform collects money and routes it to each contractor minus a fee. |
| Automated follow-up emails | **Drip campaign / marketing automation** | Pre-scheduled emails that send themselves over days. |
| Door-knocking map + routing | **Field canvassing with route optimization** | Plots houses to visit and orders them into an efficient driving route. |
| Map markers collapsing into counts | **Marker clustering** | Thousands of pins group into tidy numbered bubbles as you zoom out. |
| Estimate → contract → work order → invoice | **Sales-to-cash / order-to-cash workflow** | The full pipeline from quote to getting paid. |
| Storm warnings to your phone/email | **Event-driven alerting** | When severe weather hits a service area, it notifies the contractor. |
| Property facts (sqft, year built, value) | **Data enrichment** | Auto-fills details about a house from public datasets. |

---

*Generated from a read-through of the StormLeads repo (client + server). Counts are approximate
where derived from file/route scans; everything else is cited to specific files.*
