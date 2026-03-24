# Free Data Sources for StormLeads Storm Map

**Date:** 2026-03-24
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

### Tier 3: Nice to Have

- IEM Historical Warning Polygons (mesonet.agron.iastate.edu)
- NOAA NCEI Storm Events (damage $ amounts per storm)
- Census TIGER boundaries (territory management)
- USPS Vacancy Data (filter vacant properties)
- OpenStreetMap Buildings (roof shape metadata)

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
