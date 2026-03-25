# Free Data Sources for StormLeads Storm Map

**Date:** 2026-03-25 (updated)
**Status:** Research complete, prioritized for implementation

**CRITICAL CONSTRAINT:** Production DB is Neon free tier (0.5 GB). All external data must be
queried ON-DEMAND from free APIs at runtime — never bulk-imported into our DB. Only store
user-generated data (leads, estimates, tasks, notes). Sources marked ❌ BULK are documented
for reference but must NOT be imported.

## Already Integrated
- SPC Daily Storm Reports (hail/wind/tornado CSVs) — on-demand from SPC
- MRMS MESH Max (radar-derived hail swaths from NOAA S3) — on-demand tile fetch
- NWS Alerts API (severe thunderstorm/tornado warnings with polygons) — on-demand REST
- FEMA NSI (building type, sqft, year built, stories, foundation, replacement value) — on-demand per-bbox/polygon
- County ArcGIS Parcel Data (TX counties: Harris, Bexar, Williamson, Hays + TX statewide) — DB-stored
- Google Solar API (roof segments, pitch, area, solar potential) — on-demand per-address

---

## On-Demand API Catalog (Query at Runtime — No DB Storage)

### Tier 1: High Impact, Easy Implementation (1-2 days each)

#### 1. NOAA SWDI REST API (Radar Hail History per Location) ⭐ NEW
- **URL:** `https://www.ncdc.noaa.gov/swdiws/csv/nx3hail/{startDate}:{endDate}?bbox={w},{s},{e},{n}`
- **What:** On-demand query of radar-detected hail signatures by bbox and date range. Returns lat/lng, estimated hail size, probability, date, radar station. 10+ years of data, 4.5M+ records nationwide.
- **On-demand:** YES — REST API, query by bbox + date range, CSV/JSON/XML/KMZ/Shapefile response
- **Truly free:** Yes, no API key, no rate limit documented
- **API pattern:** `GET https://www.ncdc.noaa.gov/swdiws/csv/nx3hail/20240101:20260325?bbox=-97.8,30.2,-97.6,30.4`
- **Also available:** `nx3hail_all` (all signatures), `nx3meso` (mesocyclones), `nx3tvs` (tornado vortex), `nx3structure` (storm cells)
- **Why:** Historical hail damage per property without storing anything — query by storm swath bbox to show "this area had radar-confirmed hail X times in the past 10 years"
- **Implementation:** Easy — fetch CSV, parse, overlay on map as historical hail markers
- **Recommendation:** HIGH PRIORITY — this is the "Honey Hole Finder" without any DB storage

#### 2. FEMA Disaster Declarations API
- **URL:** `https://www.fema.gov/api/open/v2/DisasterDeclarations?$filter=state eq 'Texas'`
- **What:** All federally declared disasters by county, filterable by state/type/date
- **On-demand:** YES — REST API with OData filters
- **Truly free:** Yes, no API key required
- **API pattern:** `GET https://www.fema.gov/api/open/v2/DisasterDeclarations?$filter=state eq 'Texas' and incidentType eq 'Severe Storm(s)'&$top=100`
- **Why:** FEMA-declared areas = easier insurance claims = higher roofer conversion
- **Implementation:** Easy (half day)
- **Recommendation:** HIGH — display FEMA disaster badge on properties in declared counties

#### 3. FEMA Housing Assistance Density
- **URL:** `https://www.fema.gov/api/open/v2/HousingAssistanceOwners?$filter=zipCode eq '78660'`
- **What:** Counts of FEMA assistance applications by ZIP code
- **On-demand:** YES — REST API with OData filters
- **Truly free:** Yes, no API key required
- **Why:** ZIP codes with high applications = verified damage neighborhoods
- **Implementation:** Easy (half day)

#### 4. Census ACS Demographics
- **URL:** `https://api.census.gov/data/2023/acs/acs5?get=B25035_001E,B25003_002E&for=block%20group:*&in=state:48+county:453`
- **What:** Median home age, home ownership rate, income, home value by block group
- **On-demand:** YES — REST API, query by geography (state/county/tract/block group)
- **Truly free:** Yes, free API key (instant signup)
- **Why:** Lead scoring: older homes + high ownership + recent storm = premium leads
- **Implementation:** 1-2 days
- **Recommendation:** HIGH — enables automated lead scoring without storing census data

#### 5. USGS National Map Imagery (NAIP Tiles) ⭐ NEW
- **URL:** `https://basemap.nationalmap.gov/arcgis/rest/services/USGSImageryOnly/MapServer`
- **What:** Free high-resolution aerial imagery tiles (60cm-1m NAIP) covering the entire US. Served as standard map tiles (WMTS/tile endpoint).
- **On-demand:** YES — standard tile server, integrates as a map layer
- **Truly free:** Yes, no API key, US government public data
- **API pattern:** Tile URL: `https://basemap.nationalmap.gov/arcgis/rest/services/USGSImageryOnly/MapServer/tile/{z}/{y}/{x}`
- **Why:** Free high-res aerial imagery layer — competitors (EagleView, Nearmap) charge $$$
- **Implementation:** Easy — add as tile layer to Google Maps or Leaflet
- **Recommendation:** HIGH — one-line integration, massive visual upgrade

#### 6. Overture Maps REST API (Building Footprints) ⭐ NEW
- **URL:** `https://api.overturemapsapi.com/buildings?lat=30.27&lng=-97.74&radius=500`
- **What:** 2.3B building footprints (Microsoft + Google + OSM + Meta). Query by lat/lng + radius. Returns building polygons with height, roof shape, building class, level count.
- **On-demand:** YES — REST API by lat/lng/radius, JSON/GeoJSON/CSV response
- **Truly free:** Free tier available (API key required from thatapicompany.com). Also available via Python CLI (`pip install overturemaps`) for bbox queries against cloud GeoParquet.
- **API pattern:** `GET https://api.overturemapsapi.com/buildings?lat=30.27&lng=-97.74&radius=1000&format=geojson`
- **Also:** Python CLI: `overturemaps download --bbox=-97.8,30.2,-97.7,30.3 -f geojson --type=building -o buildings.geojson`
- **Why:** Roof area estimation where Google Solar has no coverage. Building class (residential/commercial) filters.
- **Implementation:** 1-2 days
- **Recommendation:** HIGH — best available open building footprint data, queryable on-demand

#### 7. Open Topo Data API (Elevation per Coordinate) ⭐ NEW
- **URL:** `https://api.opentopodata.org/v1/ned10m?locations=30.27,-97.74`
- **What:** Elevation data per coordinate using USGS NED 10m, SRTM, or other DEMs. Returns elevation in meters.
- **On-demand:** YES — REST API, query by lat/lng
- **Truly free:** Yes, public instance with 1 req/sec rate limit. Self-hostable for production.
- **API pattern:** `GET https://api.opentopodata.org/v1/ned10m?locations=30.27,-97.74|30.28,-97.73` (pipe-separated batch)
- **Why:** Elevation + slope data helps assess drainage, flood risk, flat-roof-vs-pitched
- **Implementation:** Easy
- **Recommendation:** LOW — nice to have for property enrichment

### Tier 2: High Impact, Medium Implementation (2-5 days each)

#### 8. OSM Overpass API (Building + Roof Metadata)
- **URL:** `https://overpass-api.de/api/interpreter`
- **What:** Building polygons with crowd-sourced tags: `roof:material`, `roof:shape`, `roof:levels`, `building:levels`, `building:material`.
- **On-demand:** YES — POST query by bbox, returns XML/JSON
- **Truly free:** Yes, no API key. Fair-use throttling (~10,000 requests/day on public servers).
- **API pattern:** `POST https://overpass-api.de/api/interpreter` with body: `[out:json];way["building"]["roof:material"](30.2,-97.8,30.4,-97.6);out body;>;out skel qt;`
- **Why:** Supplemental roof material data (metal, tile, shingle, concrete). Coverage varies — urban areas better.
- **Implementation:** Easy-Medium (Overpass QL query language)
- **Recommendation:** MEDIUM — useful for roof material enrichment where county records lack it

#### 9. FEMA National Flood Hazard Layer (NFHL)
- **URL:** `https://hazards.fema.gov/arcgis/rest/services/public/NFHL/MapServer`
- **What:** Flood zones, base flood elevations, floodway boundaries. 90%+ of US population covered.
- **On-demand:** YES — ArcGIS REST spatial query by geometry/bbox
- **Truly free:** Yes, no API key needed
- **API pattern:** `GET https://hazards.fema.gov/arcgis/rest/services/public/NFHL/MapServer/28/query?geometry=-97.74,30.27,-97.73,30.28&geometryType=esriGeometryEnvelope&f=json`
- **Why:** Flood zone properties may have water + storm damage — higher-value leads
- **Implementation:** Easy-Medium (ArcGIS REST spatial queries)
- **Recommendation:** MEDIUM — adds flood risk layer to property enrichment

#### 10. Iowa Environmental Mesonet (IEM) — Historical SPC Reports API
- **URL:** `https://mesonet.agron.iastate.edu/api/`
- **What:** Archived SPC storm reports in queryable REST format, NEXRAD radar composites, ASOS/AWOS weather station data. Good for historical lookups.
- **On-demand:** YES — REST API, query by date range + location
- **Truly free:** Yes, no API key
- **API pattern:** `GET https://mesonet.agron.iastate.edu/api/1/nws/lsr.geojson?wfo=EWX&begints=2024-01-01T00:00Z&endts=2024-12-31T23:59Z`
- **Why:** Historical storm reports for lead scoring
- **Implementation:** Easy
- **Recommendation:** MEDIUM — complements SWDI with NWS-verified ground-truth reports

#### 11. OpenFEMA Full API Catalog
- **URL:** `https://www.fema.gov/about/openfema/api`
- **What:** Full FEMA open data: disaster declarations, individual assistance, public assistance, NFIP claims, hazard mitigation grants.
- **On-demand:** YES — RESTful JSON API with OData filters
- **Truly free:** Yes, no API key required
- **Endpoints:**
  - `DisasterDeclarations` — per county/state/type
  - `HousingAssistanceOwners` — per ZIP
  - `IndividualAssistanceHousingRegistrantsLargeDisasters` — detailed per-registrant data
  - `FimaNfipClaims` — flood insurance claims per ZIP
- **Implementation:** Easy
- **Recommendation:** HIGH — multiple endpoints for lead scoring and damage verification

#### 12. Building Permit Data (Major TX Cities)
- **URLs:** data.austintexas.gov, data.houstontx.gov, data.sanantonio.gov
- **What:** Roofing permits with dates, contractors, costs. Each city has Socrata SODA API.
- **On-demand:** YES — Socrata SODA API, query by address/date/permit type
- **Truly free:** Yes, no API key for basic access (app token recommended for rate limits)
- **API pattern:** `GET https://data.austintexas.gov/resource/3syk-w9eu.json?$where=permit_type_desc like '%ROOF%'&$limit=50`
- **Why:** Skip already re-roofed properties; track competitor activity
- **Implementation:** 3-5 days (per-city adapters)
- **Recommendation:** MEDIUM — high value but requires per-city adapter work

### Tier 3: Nice to Have / Supplemental

#### 13. US Census Geocoder (Free Geocoding)
- **URL:** `https://geocoding.geo.census.gov/geocoder/locations/onelineaddress?address=123+Main+St,Austin,TX&benchmark=Public_AR_Current&format=json`
- **What:** Free address-to-coordinates geocoding. Single address or batch up to 10,000.
- **On-demand:** YES — REST API, per-address or CSV batch
- **Truly free:** Yes, no API key, no per-request charge
- **Why:** Eliminates Google Geocoding API costs for CSV imports
- **Implementation:** Easy
- **Recommendation:** HIGH — direct Google Geocoding replacement for cost savings

#### 14. RentCast Property API (Free Tier)
- **URL:** `https://api.rentcast.io/v1/properties?address=123+Main+St,Austin,TX`
- **What:** Property details, owner info, tax assessor data, building characteristics (year built, sqft, bedrooms, lot size).
- **On-demand:** YES — REST API, per-address lookup
- **Truly free:** 50 free calls/month, no credit card. Paid: $40/mo for 1000 calls.
- **Why:** Ad-hoc property lookups for lead enrichment when county data is missing
- **Implementation:** Easy
- **Recommendation:** LOW (50/mo too limited for regular use, but good for high-value lead enrichment)

#### 15. NWS Weather API (Active Alerts & Forecasts)
- **URL:** `https://api.weather.gov/alerts/active?point=30.27,-97.74`
- **What:** Active weather alerts, forecasts, and observations by coordinate. Already partially integrated (NWS Alerts).
- **On-demand:** YES — REST API, per-coordinate
- **Truly free:** Yes, no API key (User-Agent header requested)
- **Why:** Active severe weather alerts for real-time storm tracking
- **Implementation:** Already done (alerts); could add forecast integration

#### 16. OSRM / Valhalla (Free Routing for Canvassing)
- **URL:** `https://router.project-osrm.org/route/v1/driving/-97.74,30.27;-97.75,30.28?overview=full`
- **What:** Open-source routing engines built on OSM data. Compute driving routes, distance matrices, optimized multi-stop routes.
- **On-demand:** YES — REST API (public demo server)
- **Truly free:** Yes, self-hosted or public demo API
- **Why:** Canvassing route optimization — shortest path through storm-damaged neighborhoods
- **Implementation:** Easy (demo API) to Medium (self-hosted for production)

#### 17. Copernicus Sentinel-2 Imagery
- **URL:** `https://dataspace.copernicus.eu/`
- **What:** 10m resolution optical imagery, global, 3-5 day revisit. 13 spectral bands.
- **On-demand:** YES — OData/STAC APIs for tile queries
- **Truly free:** Yes (EU mandate). Free registration for API token.
- **Why:** Before/after change detection for tornado damage at neighborhood level
- **Implementation:** Medium
- **Recommendation:** LOW — 10m too coarse for individual roofs

### Sources to AVOID (Bulk Import — Violates DB Constraints)

These are valuable data sources but require bulk import into PostGIS, which violates our 0.5 GB Neon free tier constraint. Documented for reference only.

- ❌ **SPC SVRGIS Historical Archive** — Shapefiles require bulk import (~millions of rows). Use SWDI REST API instead for on-demand historical queries.
- ❌ **Microsoft Building Footprints** — 130M+ polygons, TX file alone ~4GB. Use Overture Maps REST API instead.
- ❌ **FEMA USA Structures** — Bulk ArcGIS Hub download. Already have FEMA NSI live API.
- ❌ **VIDA Combined Buildings** — 2.7B footprints, massive dataset.
- ❌ **OpenBuildingMap** — GEE or bulk GeoParquet. Use Overture REST API instead.
- ❌ **NLCD Tree Canopy Cover** — Raster data requires tile server infrastructure.
- ❌ **NOAA Storm Events CSVs** — Bulk CSV export. Use SWDI REST API instead.

### Previously listed (Tier 3)
- Census TIGER boundaries (territory management) — available via Census API on-demand
- USPS Vacancy Data (filter vacant properties) — requires bulk download

---

## Competitor Data Source Replication

| HailTrace Feature | Free Alternative | On-Demand? | Status |
|---|---|---|---|
| Hail swath maps | MRMS MESH + SPC reports | Yes | DONE |
| Weather history per property | SWDI REST API (10+ years hail) | Yes — query by bbox+date | TODO |
| Impacted structure counts | FEMA NSI + county parcels | Yes | DONE |
| "Honey Hole Finder" | SWDI hail history + Census ACS | Yes — both on-demand | TODO |
| Meteorologist verification | Algorithm-only (MRMS + NWS) | N/A | N/A |

| Rooftops.ai Feature | Free Alternative | On-Demand? | Status |
|---|---|---|---|
| Satellite roof measurements | Google Solar API + Overture REST | Yes | PARTIAL |
| Solar potential | Google Solar API | Yes | DONE |
| AI proposals | Any LLM API (~$0.01/request) | Yes | TODO |

| EagleView/RoofScope Feature | Free Alternative | On-Demand? | Status |
|---|---|---|---|
| Aerial roof measurement | Google Solar segments + Overture footprints | Yes | PARTIAL |
| High-res aerial imagery | USGS National Map tiles (NAIP 60cm) | Yes — tile server | TODO |
| Property reports | FEMA NSI + County records + Census ACS | Yes | PARTIAL |

### Key Competitive Insight

HailTrace's core hail swath maps are built on **NOAA MRMS MESH data** — the exact same freely-available dataset StormLeads already ingests. Their differentiation is meteorologist review + 70-year history.

**Critical discovery:** The NOAA SWDI REST API (`ncdc.noaa.gov/swdiws/`) provides the same historical hail data that HailScore and HailTrace use — queryable on-demand by bbox and date range. This means we can build "Honey Hole Finder" WITHOUT storing any historical data in our DB. Query pattern: `GET /swdiws/csv/nx3hail/20150101:20260325?bbox=-97.8,30.2,-97.6,30.4`

The paid-only components competitors use:
- **Cole Information** for property owner/phone data (we use free county records instead)
- **OneClick Code** for building codes (could replicate with ICC code lookup)
- **Nearmap** for aerial imagery (we can use free USGS NAIP tiles instead)

StormLeads already matches or exceeds HailTrace on data sources. The remaining gaps, all achievable with free on-demand APIs:
1. Historical hail frequency per area (SWDI REST API — NO DB storage needed)
2. Lead scoring algorithm (Census ACS + FEMA declarations + SWDI history — all on-demand)
3. Canvassing route optimization (OSRM public API — on-demand)
4. High-res aerial imagery layer (USGS National Map tiles — on-demand)

---

## Lead Scoring Algorithm (Future)

Combine data sources for automated lead scoring:
```
Score = (historical_hail_frequency × 0.3)
      + (home_age_factor × 0.2)
      + (ownership_rate × 0.15)
      + (home_value_factor × 0.15)
      + (storm_proximity × 0.1)
      + (fema_declaration × 0.05)
      + (tree_canopy_risk × 0.05)
```

This would be a genuine differentiator no competitor offers.
