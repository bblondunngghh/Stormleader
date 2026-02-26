# SwathIQ - Hail & Wind Storm Tracker + Lead Generation Platform

## Project Overview

Build a full-stack web application called **StormLeads** that tracks hail and wind storms using free NOAA/NEXRAD radar data, visualizes storm damage swaths on an interactive map, cross-references affected properties with public county appraisal data, and retrieves homeowner contact information via skip trace APIs for roofing lead generation.

This application will serve two purposes:

1. **Internal tool for Creekstone Roofing** — an admin panel for storm monitoring and lead generation in the Austin, TX market
1. **SaaS product** — a multi-tenant platform that can be sold to other roofing companies, restoration contractors, and insurance professionals nationwide

## Tech Stack

- **Frontend**: React (consistent with my existing projects)
- **Backend**: Node.js / Express
- **Database**: PostgreSQL (with PostGIS extension for geospatial queries)
- **Maps**: Google Maps API (for customer-facing instant quote / satellite views) + Mapbox GL JS (for internal storm tracking map with custom data overlays)
- **Deployment**: Designed for cloud deployment (AWS, Vercel, or similar)
- **Authentication**: JWT-based auth with role-based access control (for multi-tenant SaaS)

## Architecture — SaaS Multi-Tenant Design

Design the application from the ground up as a multi-tenant SaaS platform:

- **Tenant isolation**: Each roofing company is a "tenant" with their own service area, users, leads, and settings
- **Subscription tiers**:
  - **Free/Demo**: View storm map, limited to 1 metro area, no skip tracing
  - **Pro**: Full storm tracking, skip tracing (usage-based), lead management, email/SMS outreach, 1 metro area
  - **Enterprise**: Multiple metro areas, API access, white-label options, team management
- **Admin super-panel**: Platform-wide admin dashboard for managing tenants, monitoring usage, billing
- **Billing integration**: Stripe for subscription management and usage-based skip trace billing
- **Onboarding flow**: New tenant signs up → selects service area (metro/county) → configures company branding → starts receiving storm alerts

### Database Schema Considerations

- `tenants` table (company info, subscription tier, service area polygon, branding/logo)
- `users` table (belongs to tenant, role: admin/manager/sales_rep)
- `storm_events` table (storm data, swath geometry stored as PostGIS polygons, hail size, wind speed, timestamp)
- `properties` table (address, lat/lng, owner name, property details from county appraisal data)
- `leads` table (belongs to tenant + storm_event, property reference, skip trace results, outreach status, assigned sales rep)
- `outreach_log` table (call/email/text/door_knock records per lead)
- `skip_trace_usage` table (track API usage per tenant for billing)

---

## Phase 1: Storm Data Ingestion & Map Visualization

### Data Sources (All Free)

**NOAA MRMS MESH (Maximum Estimated Size of Hail)**

- Source: NOAA Multi-Radar Multi-Sensor system
- Data: Pre-computed MESH grids at ~1km resolution, updated every 2 minutes during active weather
- Access: Available via NOAA's AWS S3 bucket or NCEI archives
- What it gives us: Estimated max hail size at each grid point, which accumulates over time to form the "swath"

**NOAA/NWS Storm Reports API**

- Endpoint: `https://api.weather.gov/` (free, no API key needed)
- What it gives us: Ground-truth storm spotter reports including confirmed hail size and wind speed with lat/lng coordinates
- Filter for: hail reports and wind damage/gust reports

**NOAA SWDI (Severe Weather Data Inventory)**

- Access: `https://www.ncei.noaa.gov/maps/swdi/`
- What it gives us: NEXRAD Level-III hail signatures (filtered by probability = 100% and max size > 0), mesocyclone data, tornado vortex signatures

**SPC Storm Reports**

- Source: Storm Prediction Center
- What it gives us: Daily storm reports for tornado, hail, and wind events with location, magnitude, and timestamps

### Map Implementation

- Use **Mapbox GL JS** for the storm tracking map (better for custom data layers, cheaper for internal use)
- Display storm swaths as color-coded polygons on the map:
  - Green: 0.75" - 1" hail (minor damage potential)
  - Yellow: 1" - 1.5" hail (moderate damage, worth canvassing)
  - Orange: 1.5" - 2" hail (significant damage, high priority)
  - Red: 2"+ hail (severe damage, immediate deployment)
- Display wind events with separate symbology:
  - 58-75 mph gusts (severe thunderstorm threshold)
  - 75+ mph gusts (destructive)
- Time slider to scrub through storm progression
- Toggle layers: hail swath, wind reports, NWS alerts, property overlay
- Storm event list panel showing recent storms with date, location, max hail size, estimated properties affected

### Automated Storm Monitoring

- Background service that polls NOAA data sources on a schedule (every 5-10 minutes during active weather, hourly otherwise)
- When a storm event is detected within a tenant's service area:
  - Create a `storm_event` record with the swath geometry
  - Send alert to tenant (email, SMS, push notification — configurable)
  - Pre-calculate the number of affected properties in the swath
  - Store historical storm data for trend analysis and sales reporting

---

## Phase 2: Wind Drift Correction Algorithm

### Problem

NEXRAD radar detects hail at altitude (often 15,000-20,000 feet). As hail falls, wind pushes it horizontally, so the actual ground impact can be 1-2 miles from where the radar detected it. Raw MESH swaths don't align perfectly with actual damage on the ground.

### Solution — Virtual Advection Algorithm

Implement a wind drift correction that adjusts the MESH swath to better predict where hail actually landed:

**Inputs needed:**

- MESH data (hail size + altitude of detection)
- Wind profile data at multiple altitude layers — available free from:
  - NOAA RAP (Rapid Refresh) model: `https://nomads.ncep.noaa.gov/`
  - NOAA HRRR (High-Resolution Rapid Refresh) model: higher resolution, updated hourly
  - NWS radiosondes (weather balloon data)
- Freezing level height (already in MESH calculation)
- Storm motion vector

**Calculation:**

1. For each grid cell where MESH detects hail, determine the detection altitude
1. Look up the wind speed and direction at each altitude layer between detection altitude and ground level using RAP/HRRR data
1. Estimate fall time based on hailstone size (larger hail falls faster — terminal velocity calculation)
1. Apply wind vectors at each layer during the fall time to calculate horizontal displacement
1. Shift the ground-impact point accordingly
1. Rebuild the corrected swath polygon

**This is a ballistic trajectory calculation** — the physics are well-documented:

- Terminal velocity of hail: `v = sqrt((2 * m * g) / (ρ * A * Cd))` where m=mass, g=gravity, ρ=air density, A=cross-sectional area, Cd=drag coefficient
- Horizontal displacement = integral of wind speed over fall time at each altitude layer

### Ground-Truth Feedback Loop

- When Creekstone crews confirm damage locations, log the actual damage coordinates
- Compare predicted swath vs actual damage locations
- Use this data to calibrate and improve the drift correction model over time
- Store calibration data per metro area (wind patterns differ by geography)

---

## Phase 3: Property Data & Skip Trace Integration

### County Appraisal Data (TCAD for Austin)

**Travis Central Appraisal District (TCAD)**

- Public data: property address, owner name, property value, year built, square footage, exemption status
- Homestead exemption = owner-occupied (best leads for roofing)
- Need to research: Does TCAD offer a bulk data export or API? If not, scrape or use a service like TaxNetUSA

**For SaaS scalability:**

- Build an abstraction layer for county appraisal data
- Different counties have different data formats and access methods
- Consider integrating with a national property data provider (like BatchData or ATTOM) that normalizes data across counties

### Skip Trace Integration

**Primary: Tracerfy API**

- Cost: $0.02 per record (platform) or $0.009 per credit (API)
- RESTful API with webhook notifications when jobs complete
- Returns: up to 8 phone numbers, 3 email addresses, current mailing address per record
- 70-95% accuracy depending on data quality
- No monthly minimums — pay per use
- Built-in DNC scrubbing available (Federal DNC, State DNC, DMA, TCPA Litigator)
- Endpoint for bulk CSV upload and async processing

**Implementation flow:**

1. User selects a storm event on the map
1. System queries PostGIS for all properties within the swath polygon
1. Filter for homestead-exempt properties (owner-occupied)
1. Display property list in admin panel with owner names (from county data)
1. User clicks "Skip Trace Selected" button
1. System sends property addresses + owner names to Tracerfy API
1. Webhook fires when results are ready
1. System stores results in `leads` table
1. Run DNC scrub on returned phone numbers
1. Display enriched lead list with phone, email, and contact status

**Usage tracking for SaaS billing:**

- Track skip trace API calls per tenant
- Bill tenants for skip trace usage (markup the $0.02 cost to $0.05-0.10 per record)
- Show usage dashboard in tenant admin panel

---

## Phase 4: Lead Management & Outreach

### Lead Dashboard

- Sortable/filterable table of leads per storm event
- Columns: address, owner name, phone, email, hail size at location, property value, year built, outreach status, assigned rep
- Status workflow: New → Contacted → Appointment Set → Inspected → Estimate Sent → Sold → Completed
- Assign leads to sales reps (for team-based tenants)
- Export to CSV for import into external CRMs

### Outreach Tools (Future / Premium Feature)

- Ringless voicemail drop integration (e.g., Slybroadcast API)
- Email template system with merge fields (homeowner name, storm date, hail size)
- SMS outreach with compliance tracking
- Door-knocking route optimizer — generate optimized driving routes for field reps based on lead density and priority
- Postcard/mailer integration (e.g., Lob API for physical mail)

### Reporting & Analytics

- Storm response dashboard: storms tracked, leads generated, conversion rates
- Revenue attribution: tie closed deals back to specific storm events
- ROI calculator: cost of skip tracing vs revenue generated
- Competitor analysis: response time benchmarks

---

## Phase 5: Local LLM Integration (Optional Enhancement)

### Hardware

- Running on a local machine with an NVIDIA 3090 Ti (24GB VRAM)
- Use Ollama for model serving (`http://localhost:11434/api/chat`)
- Model: Llama 3.1 8B or Llama 3.3 70B (4-bit quantized)

### Use Cases

- **Storm summary generation**: After a storm event, generate a natural language summary ("A severe thunderstorm moved through NW Austin on [date], producing hail up to 2.25 inches and wind gusts of 65 mph. Approximately 1,847 properties in the swath are owner-occupied. Priority neighborhoods: [list]")
- **Lead prioritization**: Analyze property characteristics (age of roof based on year built, property value, previous storm history) to score and prioritize leads
- **Outreach message generation**: Draft personalized voicemail scripts, email templates, and door-knocking talking points based on storm data
- **Pattern analysis**: Identify trends across historical storm data (which neighborhoods get hit most frequently, seasonal patterns, etc.)

### Implementation

- API endpoint in the backend that routes to Ollama
- Fallback: if local model is unavailable, skip LLM features (they're enhancements, not core functionality)
- For SaaS: LLM features would be server-side using a cloud-hosted model (not dependent on local hardware)

---

## SaaS Business Considerations

### Pricing Model Ideas

- **Starter**: $99/mo — 1 service area, storm tracking, 500 skip traces/mo included, 2 users
- **Professional**: $249/mo — 3 service areas, 2,000 skip traces/mo, 10 users, outreach tools
- **Enterprise**: $499+/mo — Unlimited areas, volume skip trace pricing, API access, white-label, dedicated support
- **Usage-based add-ons**: Additional skip traces at $0.05-0.10 each beyond plan limits

### Competitive Advantages vs HailTrace

- Lower cost (no meteorologist team overhead — algorithm-driven)
- Integrated skip tracing and lead management (HailTrace requires separate tools)
- Wind drift correction (differentiator for accuracy)
- Built for small-to-mid-size roofing companies (HailTrace targets enterprise)
- Self-serve onboarding (no sales calls required)

### Key Metrics to Track

- Monthly Recurring Revenue (MRR)
- Customer Acquisition Cost (CAC)
- Churn rate
- Skip traces per storm event per tenant
- Lead-to-close conversion rate (if tenants report outcomes)

---

## Development Priorities

Build in this order:

1. **Database schema + auth system** (multi-tenant foundation)
2. **Storm data ingestion service** (NOAA MRMS MESH + NWS storm reports)
3. **Map visualization** (Mapbox GL JS with swath polygons)
4. **Property data overlay** (TCAD integration for Austin MVP)
5. **Skip trace integration** (Tracerfy API)
6. **Lead management dashboard** (CRUD + status workflow)
7. **Alert system** (email/SMS notifications on new storms)
8. **Wind drift correction algorithm** (Phase 2 accuracy improvement)
9. **Tenant onboarding + Stripe billing** (SaaS launch prep)
10. **Outreach tools** (voicemail, email, SMS — premium features)

## Notes

- Start with Austin/Travis County as the MVP market since this is Creekstone's territory
- Design all data models and APIs to be market-agnostic from day one
- Every feature should work for a single tenant (Creekstone) AND scale to hundreds of tenants
- The free NOAA data is the foundation — no paid weather data dependencies for core functionality
- Skip trace costs are the primary variable cost — build usage tracking and billing from the start
