# Free Data Sources for StormLeads Storm Map

**Date:** 2026-03-24 (updated)
**Status:** Research complete, prioritized for implementation

## Already Integrated
- SPC Daily Storm Reports (hail/wind/tornado CSVs)
- MRMS MESH Max (radar-derived hail swaths from NOAA S3)
- NWS Alerts API (severe thunderstorm/tornado warnings with polygons)
- FEMA NSI (building type, sqft, year built, stories, foundation, replacement value)
- County ArcGIS Parcel Data (TX counties: Harris, Bexar, Williamson, Hays + TX statewide)
- Google Solar API (roof segments, pitch, area, solar potential)

---

## Priority Integration Roadmap

### Tier 1: High Impact, Easy Implementation (1-2 days each)

#### 1. SPC SVRGIS Historical Archive
- **URL:** https://www.spc.noaa.gov/gis/svrgis/
- **What:** Shapefiles of ALL severe weather reports from 1950 to present
- **Why:** Closes our biggest competitive gap vs HailTrace (30-day vs 70+ years)
- **Enables:** "Honey Hole Finder" — areas with frequent historical hail = prime canvassing
- **Effort:** 1-2 days (download shapefiles, ogr2ogr into PostGIS)

#### 2. FEMA Disaster Declarations API
- **URL:** https://www.fema.gov/api/open/v2/DisasterDeclarations
- **What:** All federally declared disasters by county
- **Why:** FEMA-declared areas = easier insurance claims = higher roofer conversion
- **Effort:** Half day (simple REST API)

#### 3. FEMA Housing Assistance Density
- **URL:** https://www.fema.gov/api/open/v2/HousingAssistanceOwners
- **What:** Counts of FEMA assistance applications by ZIP code
- **Why:** ZIP codes with high applications = verified damage neighborhoods
- **Effort:** Half day

#### 4. Census ACS Demographics
- **URL:** https://api.census.gov/data.html (free API key, instant)
- **What:** Median home age, home ownership rate, income, home value by block group
- **Why:** Lead scoring: older homes + high ownership + recent storm = premium leads
- **Effort:** 1-2 days

### Tier 2: High Impact, Medium Implementation (2-5 days each)

#### 5. Microsoft Building Footprints
- **URL:** https://github.com/microsoft/USBuildingFootprints
- **What:** 130M+ building footprint polygons, free GeoJSON
- **Why:** Roof area estimation where Google Solar has no coverage
- **Effort:** 2-3 days (bulk import TX file ~4GB into PostGIS)

#### 6. NAIP Aerial Imagery
- **URL:** https://planetarycomputer.microsoft.com/dataset/naip
- **What:** 60cm-1m resolution aerial imagery, entire US
- **Why:** Free high-res imagery layer — competitors charge for aerial views
- **Effort:** 1-2 days (COG tile layer integration)

#### 7. NLCD Tree Canopy Cover
- **URL:** https://www.mrlc.gov/data/nlcd-tree-canopy-cover-conus
- **What:** 30m tree canopy percentage for every pixel in US
- **Why:** High canopy = more tree-on-roof damage risk during storms
- **Effort:** 1-2 days

#### 8. Building Permit Data (Major TX Cities)
- **URLs:** data.austintexas.gov, data.houstontx.gov, data.sanantonio.gov
- **What:** Roofing permits with dates, contractors, costs
- **Why:** Skip already re-roofed properties; track competitor activity
- **Effort:** 3-5 days (per-city adapters)

### Tier 3: Nice to Have / Supplemental

#### 9. US Census Geocoder (Free Geocoding)
- **URL:** https://geocoding.geo.census.gov/geocoder/
- **What:** Free address-to-coordinates geocoding, batch up to 10,000 addresses. Also returns census tract/block/county FIPS codes.
- **Why:** Eliminates Google Geocoding API costs for bulk lookups (e.g., CSV imports).
- **Truly free:** Yes, no API key, no per-request charge.
- **Effort:** Easy (REST API or CSV batch upload)

#### 10. NOAA SWDI (Severe Weather Data Inventory)
- **URL:** https://www.ncei.noaa.gov/products/severe-weather-data-inventory
- **What:** Radar-detected hail signatures, mesocyclone signatures, tornado signatures, lightning strikes. More comprehensive than ground-truth SPC reports.
- **Truly free:** Yes, web services + bulk download at https://www1.ncdc.noaa.gov/pub/data/swdi
- **Effort:** Easy-Medium (multiple output formats: CSV, Shapefile, KMZ, XML)

#### 11. OpenFEMA Disaster & Assistance APIs
- **URL:** https://www.fema.gov/about/openfema/api
- **What:** Full FEMA open data catalog: disaster declarations, individual assistance, public assistance, NFIP claims. No API key required.
- **Truly free:** Yes.
- **Effort:** Easy (RESTful JSON API)

#### 12. Iowa Environmental Mesonet (IEM)
- **URL:** https://mesonet.agron.iastate.edu/api/
- **What:** Archived SPC storm reports in queryable format, NEXRAD radar composites, ASOS/AWOS weather station data. Good for historical lookups.
- **Truly free:** Yes, no API key.
- **Effort:** Easy (REST API with CSV/JSON output)

#### 13. FEMA USA Structures
- **URL:** https://gis-fema.hub.arcgis.com/pages/usa-structures
- **What:** Building footprints with occupancy classification (residential/commercial) for entire US. Alternative to MS Building Footprints with richer metadata.
- **Truly free:** Yes, ArcGIS Hub download.
- **Effort:** Medium (similar to MS footprints import)

#### 14. VIDA Combined Buildings Dataset
- **URL:** https://source.coop/vida/google-microsoft-osm-open-buildings
- **What:** Merged dataset of Google, Microsoft, and OSM building footprints — 2.7 billion footprints worldwide, each labeled with source.
- **Truly free:** Yes, open license.
- **Effort:** Medium-Hard (very large dataset, PostGIS or similar needed)

#### 15. Copernicus Sentinel-2 Imagery
- **URL:** https://dataspace.copernicus.eu/
- **What:** 10m resolution optical imagery, global, 3-5 day revisit. 13 spectral bands.
- **Truly free:** Yes (EU mandate). Free registration for API token.
- **Why:** Before/after change detection for tornado/large-scale damage at neighborhood level. 10m too coarse for individual roofs but good for area assessment.
- **Effort:** Medium (OData/STAC APIs)

#### 16. FEMA National Flood Hazard Layer (NFHL)
- **URL:** https://hazards.fema.gov/arcgis/rest/services/public/NFHL/MapServer
- **What:** Flood zones, base flood elevations, floodway boundaries. 90%+ of US population covered.
- **Truly free:** Yes, ArcGIS REST API, no key needed.
- **Why:** Flood zone properties may have water + storm damage — higher-value leads.
- **Effort:** Easy-Medium (ArcGIS REST spatial queries)

#### 17. NOAA Storm Events Database
- **URL:** https://www.ncei.noaa.gov/stormevents/
- **What:** Comprehensive storm event records from NWS with property damage dollar estimates, injuries, narrative descriptions.
- **Truly free:** Yes, searchable database with CSV export.
- **Why:** Dollar damage amounts per storm help prioritize which storms to target.
- **Effort:** Easy (CSV export)

#### 18. OSM Overpass API (Building Metadata)
- **URL:** https://overpass-api.de/
- **What:** Building polygons with crowd-sourced tags: `roof:material`, `roof:shape`, `roof:levels`, `building:levels`.
- **Truly free:** Yes, no API key. Fair-use throttling on public servers.
- **Why:** Supplemental roof material data where county records lack it. Coverage varies by area.
- **Effort:** Easy-Medium (Overpass QL query language)

#### 19. RentCast Property API (Free Tier)
- **URL:** https://www.rentcast.io/api
- **What:** Property details, owner info, tax assessor data, building characteristics.
- **Truly free:** 50 free calls/month, no credit card. Paid plans for more.
- **Why:** Ad-hoc property lookups for lead enrichment.
- **Effort:** Easy (REST API)

### Previously listed (Tier 3)
- Census TIGER boundaries (territory management)
- USPS Vacancy Data (filter vacant properties)
- NLCD Tree Canopy Cover (tree-on-roof damage risk)

---

## Competitor Data Source Replication

| HailTrace Feature | Free Alternative | Status |
|---|---|---|
| Hail swath maps | MRMS MESH + SPC reports | DONE |
| Weather history per property | SPC SVRGIS archive (70+ years free) | TODO |
| Impacted structure counts | FEMA NSI + county parcels | DONE |
| "Honey Hole Finder" | SVRGIS + Census demographics | TODO |
| Meteorologist verification | Algorithm-only (MRMS + NWS) | N/A |

| Rooftops.ai Feature | Free Alternative | Status |
|---|---|---|
| Satellite roof measurements | Google Solar API + MS footprints | PARTIAL |
| Solar potential | Google Solar API | DONE |
| AI proposals | Any LLM API (~$0.01/request) | TODO |

| EagleView/RoofScope Feature | Free Alternative | Status |
|---|---|---|
| Aerial roof measurement | Google Solar segments + MS footprints area calc | PARTIAL |
| High-res aerial imagery | NAIP 60cm via USGS ImageServer | TODO |
| Property reports | FEMA NSI + County records + Census ACS | PARTIAL |

### Key Competitive Insight

HailTrace's core hail swath maps are built on **NOAA MRMS MESH data** — the exact same freely-available dataset StormLeads already ingests. Their differentiation is meteorologist review + 70-year history (SPC SVRGIS, which is also free). The paid-only components they use are:
- **Cole Information** for property owner/phone data (we use free county records instead)
- **OneClick Code** for building codes (could replicate with ICC code lookup)

StormLeads already matches or exceeds HailTrace on data sources. The main gaps are:
1. Historical storm archive (SVRGIS — free, just needs import)
2. Lead scoring algorithm (all data sources are free, just needs the formula)
3. Automated canvassing route optimization (free OSM routing APIs exist)

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
