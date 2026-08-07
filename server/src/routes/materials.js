import { Router } from 'express';
import authenticate from '../middleware/authenticate.js';
import tenantScope from '../middleware/tenantScope.js';
import validateId from '../middleware/validateId.js';
import pool from '../db/pool.js';

const router = Router();
router.use(authenticate);
router.use(tenantScope);

// ============================================================
// SRS PRODUCT CATALOG — Austin, TX Market (Effective 04/15/2024)
// Salesperson: Dillon Swearengin — (512) 739-8257
// ============================================================

const MOCK_PRODUCTS = [
  // --- GAF Shingles ---
  {
    id: 'srs-shingle-001',
    name: 'GAF Royal Sovereign',
    category: 'Shingles',
    manufacturer: 'GAF',
    sku: 'GAF-RS-3TAB',
    unit: 'bundle',
    price: 37.44,
    price_per_sq: 112.32,
    description: '3-tab shingle. Affordable, clean look. Limited lifetime warranty.',
    colors: [],
    in_stock: true,
    coverage_per_unit: '33.3 sq ft',
    weight_per_unit: '65 lbs',
  },
  { id: 'srs-shingle-002', name: 'GAF Timberline Natural Shadow', category: 'Shingles', manufacturer: 'GAF', sku: 'GAF-TNS-ARCH', unit: 'bundle', price: 38.99, price_per_sq: 116.97, description: 'Architectural shingle with natural shadow line. Limited lifetime warranty.', colors: [], in_stock: true, coverage_per_unit: '33.3 sq ft', weight_per_unit: '70 lbs' },
  { id: 'srs-shingle-003', name: 'GAF Timberline HDZ', category: 'Shingles', manufacturer: 'GAF', sku: 'GAF-THDZ-ARCH', unit: 'bundle', price: 40.99, price_per_sq: 122.97, description: 'Americas #1 selling shingle. LayerLock technology. StainGuard Plus algae protection.', colors: ['Charcoal', 'Pewter Gray', 'Weathered Wood', 'Barkwood', 'Hickory', 'Shakewood', 'Slate'], in_stock: true, coverage_per_unit: '33.3 sq ft', weight_per_unit: '70 lbs' },
  { id: 'srs-shingle-004', name: 'GAF Armorshield II IR', category: 'Shingles', manufacturer: 'GAF', sku: 'GAF-ASII-IR', unit: 'bundle', price: 51.66, price_per_sq: 154.98, description: 'Impact-resistant architectural shingle. Class 4 impact rated.', colors: [], in_stock: true, coverage_per_unit: '33.3 sq ft', weight_per_unit: '75 lbs' },
  // --- IKO Shingles ---
  { id: 'srs-shingle-005', name: 'IKO Marathon 25 Plus', category: 'Shingles', manufacturer: 'IKO', sku: 'IKO-M25P-3TAB', unit: 'bundle', price: 34.35, price_per_sq: 103.05, description: '3-tab shingle. 25-year limited warranty.', colors: [], in_stock: true, coverage_per_unit: '33.3 sq ft', weight_per_unit: '65 lbs' },
  { id: 'srs-shingle-006', name: 'IKO Cambridge', category: 'Shingles', manufacturer: 'IKO', sku: 'IKO-CAM-ARCH', unit: 'bundle', price: 37.65, price_per_sq: 112.95, description: 'Architectural shingle with ArmourZone reinforced nailing area.', colors: [], in_stock: true, coverage_per_unit: '33.3 sq ft', weight_per_unit: '68 lbs' },
  { id: 'srs-shingle-007', name: 'IKO Dynasty', category: 'Shingles', manufacturer: 'IKO', sku: 'IKO-DYN-ARCH', unit: 'bundle', price: 39.45, price_per_sq: 118.35, description: 'Premium architectural shingle with ArmourZone and high wind resistance.', colors: [], in_stock: true, coverage_per_unit: '33.3 sq ft', weight_per_unit: '70 lbs' },
  { id: 'srs-shingle-008', name: 'IKO Nordic', category: 'Shingles', manufacturer: 'IKO', sku: 'IKO-NRD-PREM', unit: 'bundle', price: 51.25, price_per_sq: 153.75, description: 'Premium performance shingle with dramatic color blends.', colors: [], in_stock: true, coverage_per_unit: '33.3 sq ft', weight_per_unit: '75 lbs' },
  // --- CertainTeed Shingles ---
  { id: 'srs-shingle-009', name: 'CertainTeed XT 25', category: 'Shingles', manufacturer: 'CertainTeed', sku: 'CT-XT25-3TAB', unit: 'bundle', price: 35.30, price_per_sq: 105.90, description: '3-tab shingle. 25-year warranty.', colors: [], in_stock: true, coverage_per_unit: '33.3 sq ft', weight_per_unit: '65 lbs' },
  { id: 'srs-shingle-010', name: 'CertainTeed Landmark AR', category: 'Shingles', manufacturer: 'CertainTeed', sku: 'CT-LMK-ARCH', unit: 'bundle', price: 38.33, price_per_sq: 115.00, description: 'Dual-layered architectural shingle. Max Def colors. StreakFighter algae-resistant.', colors: ['Moire Black', 'Georgetown Gray', 'Weathered Wood', 'Driftwood', 'Burnt Sienna'], in_stock: true, coverage_per_unit: '33.3 sq ft', weight_per_unit: '68 lbs' },
  { id: 'srs-shingle-011', name: 'CertainTeed Landmark MAX DEF', category: 'Shingles', manufacturer: 'CertainTeed', sku: 'CT-LMKMD-ARCH', unit: 'bundle', price: 38.35, price_per_sq: 119.00, description: 'Max definition architectural shingle with enhanced color depth.', colors: [], in_stock: true, coverage_per_unit: '33.3 sq ft', weight_per_unit: '70 lbs' },
  { id: 'srs-shingle-012', name: 'CertainTeed Landmark Climateflex IR', category: 'Shingles', manufacturer: 'CertainTeed', sku: 'CT-LMKCF-IR', unit: 'bundle', price: 51.24, price_per_sq: 153.72, description: 'Impact-resistant shingle with cold-weather flexibility.', colors: [], in_stock: true, coverage_per_unit: '33.3 sq ft', weight_per_unit: '75 lbs' },
  // --- Owens Corning Shingles ---
  { id: 'srs-shingle-013', name: 'Owens Corning Supreme', category: 'Shingles', manufacturer: 'Owens Corning', sku: 'OC-SUP-3TAB', unit: 'bundle', price: 35.33, price_per_sq: 105.99, description: '3-tab shingle. 25-year limited warranty.', colors: [], in_stock: true, coverage_per_unit: '33.3 sq ft', weight_per_unit: '65 lbs' },
  { id: 'srs-shingle-014', name: 'Owens Corning Oakridge', category: 'Shingles', manufacturer: 'Owens Corning', sku: 'OC-OAK-ARCH', unit: 'bundle', price: 40.21, price_per_sq: 120.63, description: 'Architectural shingle. Limited lifetime warranty.', colors: [], in_stock: true, coverage_per_unit: '33.3 sq ft', weight_per_unit: '70 lbs' },
  { id: 'srs-shingle-015', name: 'Owens Corning Duration Tru Def', category: 'Shingles', manufacturer: 'Owens Corning', sku: 'OC-DUR-TD', unit: 'bundle', price: 41.20, price_per_sq: 123.60, description: 'Architectural shingle with SureNail Technology. TruDefinition color.', colors: ['Onyx Black', 'Estate Gray', 'Driftwood', 'Brownwood', 'Desert Tan'], in_stock: true, coverage_per_unit: '33.3 sq ft', weight_per_unit: '73 lbs' },
  // --- Atlas Shingles ---
  { id: 'srs-shingle-016', name: 'Atlas Glassmaster', category: 'Shingles', manufacturer: 'Atlas', sku: 'ATL-GM-3TAB', unit: 'bundle', price: 33.33, price_per_sq: 99.99, description: '3-tab shingle with Scotchgard algae protection.', colors: [], in_stock: true, coverage_per_unit: '33.3 sq ft', weight_per_unit: '64 lbs' },
  { id: 'srs-shingle-017', name: 'Atlas ProLam', category: 'Shingles', manufacturer: 'Atlas', sku: 'ATL-PL-ARCH', unit: 'bundle', price: 37.20, price_per_sq: 111.60, description: 'Architectural shingle with Scotchgard protection.', colors: [], in_stock: true, coverage_per_unit: '33.3 sq ft', weight_per_unit: '68 lbs' },
  { id: 'srs-shingle-018', name: 'Atlas Pinnacle Pristine', category: 'Shingles', manufacturer: 'Atlas', sku: 'ATL-PP-ARCH', unit: 'bundle', price: 38.59, price_per_sq: 115.77, description: 'Architectural shingle with Scotchgard protection and enhanced color.', colors: [], in_stock: true, coverage_per_unit: '33.3 sq ft', weight_per_unit: '70 lbs' },
  { id: 'srs-shingle-019', name: 'Atlas Pinnacle Impact', category: 'Shingles', manufacturer: 'Atlas', sku: 'ATL-PI-IR', unit: 'bundle', price: 46.70, price_per_sq: 140.10, description: 'Impact-resistant architectural shingle. Class 4 rated.', colors: [], in_stock: true, coverage_per_unit: '33.3 sq ft', weight_per_unit: '75 lbs' },
  { id: 'srs-shingle-020', name: 'Atlas StormMaster Shake', category: 'Shingles', manufacturer: 'Atlas', sku: 'ATL-SMS-IR', unit: 'bundle', price: 57.51, price_per_sq: 172.53, description: 'Premium impact-resistant shingle with shake appearance.', colors: [], in_stock: true, coverage_per_unit: '33.3 sq ft', weight_per_unit: '80 lbs' },
  // --- TAMKO Shingles ---
  { id: 'srs-shingle-021', name: 'TAMKO Elite Glass-Seal', category: 'Shingles', manufacturer: 'TAMKO', sku: 'TAM-EGS-3TAB', unit: 'bundle', price: 35.49, price_per_sq: 106.47, description: '3-tab fiberglass shingle.', colors: [], in_stock: true, coverage_per_unit: '33.3 sq ft', weight_per_unit: '65 lbs' },
  { id: 'srs-shingle-022', name: 'TAMKO Heritage', category: 'Shingles', manufacturer: 'TAMKO', sku: 'TAM-HER-ARCH', unit: 'bundle', price: 38.82, price_per_sq: 116.46, description: 'Architectural shingle with rich color blends.', colors: [], in_stock: true, coverage_per_unit: '33.3 sq ft', weight_per_unit: '70 lbs' },
  { id: 'srs-shingle-023', name: 'TAMKO Titan XT', category: 'Shingles', manufacturer: 'TAMKO', sku: 'TAM-TXT-ARCH', unit: 'bundle', price: 42.01, price_per_sq: 126.03, description: 'Premium architectural shingle with enhanced wind and impact performance.', colors: [], in_stock: true, coverage_per_unit: '33.3 sq ft', weight_per_unit: '73 lbs' },
  // --- Starter Strips ---
  { id: 'srs-starter-001', name: 'GAF ProStart Starter', category: 'Starter & Ridge', manufacturer: 'GAF', sku: 'GAF-PS-START', unit: 'bundle', price: 52.80, description: 'Starter strip (120 lf/bdl). Factory-applied sealant.', colors: [], in_stock: true, coverage_per_unit: '120 lf' },
  { id: 'srs-starter-002', name: 'GAF QuickStart 9"x33\' P/S', category: 'Starter & Ridge', manufacturer: 'GAF', sku: 'GAF-QS-ROLL', unit: 'roll', price: 59.06, description: 'Peel-and-stick starter roll.', colors: [], in_stock: true, coverage_per_unit: '33 lf' },
  { id: 'srs-starter-003', name: 'GAF WeatherBlocker Starter', category: 'Starter & Ridge', manufacturer: 'GAF', sku: 'GAF-WB-START', unit: 'bundle', price: 75.45, description: 'Premium starter strip (50 lf/bdl).', colors: [], in_stock: true, coverage_per_unit: '50 lf' },
  { id: 'srs-starter-004', name: 'IKO Leading Edge Starter', category: 'Starter & Ridge', manufacturer: 'IKO', sku: 'IKO-LE-START', unit: 'bundle', price: 61.65, description: 'Starter strip (123 lf/bdl).', colors: [], in_stock: true, coverage_per_unit: '123 lf' },
  { id: 'srs-starter-005', name: 'CertainTeed Swift Starter', category: 'Starter & Ridge', manufacturer: 'CertainTeed', sku: 'CT-SS-START', unit: 'bundle', price: 52.91, description: 'Starter strip (116 lf/bdl).', colors: [], in_stock: true, coverage_per_unit: '116 lf' },
  { id: 'srs-starter-006', name: 'OC Starter Strip', category: 'Starter & Ridge', manufacturer: 'Owens Corning', sku: 'OC-SS-START', unit: 'bundle', price: 58.99, description: 'Starter strip (100 lf/bdl).', colors: [], in_stock: true, coverage_per_unit: '100 lf' },
  { id: 'srs-starter-007', name: 'Atlas HP42 Starter', category: 'Starter & Ridge', manufacturer: 'Atlas', sku: 'ATL-HP42-START', unit: 'bundle', price: 66.20, description: 'Starter strip (140 lf/bdl).', colors: [], in_stock: true, coverage_per_unit: '140 lf' },
  { id: 'srs-starter-008', name: 'TAMKO 10" Starter', category: 'Starter & Ridge', manufacturer: 'TAMKO', sku: 'TAM-10-START', unit: 'bundle', price: 46.10, description: 'Starter strip (100 lf/bdl).', colors: [], in_stock: true, coverage_per_unit: '100 lf' },
  // --- Hip & Ridge ---
  { id: 'srs-ridge-001', name: 'GAF Seal-a-Ridge', category: 'Hip & Ridge', manufacturer: 'GAF', sku: 'GAF-SAR-HR', unit: 'bundle', price: 67.13, description: 'Hip & ridge cap (25 lf/bdl).', colors: [], in_stock: true, coverage_per_unit: '25 lf' },
  { id: 'srs-ridge-002', name: 'GAF Timbertex', category: 'Hip & Ridge', manufacturer: 'GAF', sku: 'GAF-TTX-HR', unit: 'bundle', price: 64.48, description: 'Premium hip & ridge (20 lf/bdl). Double-layer design.', colors: [], in_stock: true, coverage_per_unit: '20 lf' },
  { id: 'srs-ridge-003', name: 'GAF Z-Ridge', category: 'Hip & Ridge', manufacturer: 'GAF', sku: 'GAF-ZR-HR', unit: 'bundle', price: 71.00, description: 'Hip & ridge (33 lf/bdl).', colors: [], in_stock: true, coverage_per_unit: '33 lf' },
  { id: 'srs-ridge-004', name: 'GAF Seal-a-Ridge AS IR', category: 'Hip & Ridge', manufacturer: 'GAF', sku: 'GAF-SARIR-HR', unit: 'bundle', price: 86.43, description: 'Impact-resistant hip & ridge (25 lf/bdl).', colors: [], in_stock: true, coverage_per_unit: '25 lf' },
  { id: 'srs-ridge-005', name: 'GAF HIP & RIDGE 12"', category: 'Hip & Ridge', manufacturer: 'GAF', sku: 'GAF-HR12-HR', unit: 'bundle', price: 75.25, description: '12" hip & ridge (36 lf/bdl).', colors: [], in_stock: true, coverage_per_unit: '36 lf' },
  { id: 'srs-ridge-006', name: 'IKO HIP & RIDGE ULTRA HP IR', category: 'Hip & Ridge', manufacturer: 'IKO', sku: 'IKO-HPIR-HR', unit: 'bundle', price: 89.00, description: 'Impact-resistant hip & ridge (20 lf/bdl).', colors: [], in_stock: true, coverage_per_unit: '20 lf' },
  { id: 'srs-ridge-007', name: 'CertainTeed Cedar Crest H&R IR', category: 'Hip & Ridge', manufacturer: 'CertainTeed', sku: 'CT-CCIR-HR', unit: 'bundle', price: 75.38, description: 'Impact-resistant hip & ridge (20 lf/bdl).', colors: [], in_stock: true, coverage_per_unit: '20 lf' },
  { id: 'srs-ridge-008', name: 'CertainTeed Climateflex H&R IR', category: 'Hip & Ridge', manufacturer: 'CertainTeed', sku: 'CT-CFIR-HR', unit: 'bundle', price: 87.59, description: 'Impact-resistant hip & ridge (33 lf/bdl).', colors: [], in_stock: true, coverage_per_unit: '33 lf' },
  { id: 'srs-ridge-009', name: 'CertainTeed Shadow Ridge H&R', category: 'Hip & Ridge', manufacturer: 'CertainTeed', sku: 'CT-SR-HR', unit: 'bundle', price: 67.77, description: 'Hip & ridge (30 lf/bdl).', colors: [], in_stock: true, coverage_per_unit: '30 lf' },
  { id: 'srs-ridge-010', name: 'OC Pro Edge H&R', category: 'Hip & Ridge', manufacturer: 'Owens Corning', sku: 'OC-PE-HR', unit: 'bundle', price: 77.77, description: 'Hip & ridge (33 lf/bdl).', colors: [], in_stock: true, coverage_per_unit: '33 lf' },
  { id: 'srs-ridge-011', name: 'OC Rizerridge H&R', category: 'Hip & Ridge', manufacturer: 'Owens Corning', sku: 'OC-RR-HR', unit: 'bundle', price: 85.20, description: 'Premium hip & ridge (33 lf/bdl).', colors: [], in_stock: true, coverage_per_unit: '33 lf' },
  { id: 'srs-ridge-012', name: 'Atlas Pro-Cut H&R', category: 'Hip & Ridge', manufacturer: 'Atlas', sku: 'ATL-PC-HR', unit: 'bundle', price: 71.68, description: 'Hip & ridge (31 lf/bdl).', colors: [], in_stock: true, coverage_per_unit: '31 lf' },
  { id: 'srs-ridge-013', name: 'Atlas High Profile H&R', category: 'Hip & Ridge', manufacturer: 'Atlas', sku: 'ATL-HP-HR', unit: 'bundle', price: 96.35, description: 'Premium hip & ridge (20 lf/box).', colors: [], in_stock: true, coverage_per_unit: '20 lf' },
  { id: 'srs-ridge-014', name: 'TAMKO Hip & Ridge', category: 'Hip & Ridge', manufacturer: 'TAMKO', sku: 'TAM-HR-HR', unit: 'bundle', price: 64.91, description: 'Hip & ridge (33 lf/bdl).', colors: [], in_stock: true, coverage_per_unit: '33 lf' },
  // --- Underlayment ---
  { id: 'srs-under-001', name: 'SPEC Synthetic Underlay 10SQ', category: 'Underlayment', manufacturer: 'SPEC', sku: 'SPEC-SYN-10', unit: 'roll', price: 79.95, description: 'Synthetic underlayment. 10SQ coverage per roll.', colors: [], in_stock: true, coverage_per_unit: '1000 sq ft' },
  { id: 'srs-under-002', name: 'RhinoRoof U20 Synthetic 10SQ', category: 'Underlayment', manufacturer: 'RhinoRoof', sku: 'RR-U20-10', unit: 'roll', price: 83.44, description: 'Synthetic underlayment. 10SQ coverage per roll.', colors: [], in_stock: true, coverage_per_unit: '1000 sq ft' },
  { id: 'srs-under-003', name: 'Palisades High Temp 10SQ', category: 'Underlayment', manufacturer: 'Palisades', sku: 'PAL-HT-10', unit: 'roll', price: 125.00, description: 'High-temperature synthetic underlayment. 10SQ roll.', colors: [], in_stock: true, coverage_per_unit: '1000 sq ft' },
  { id: 'srs-under-004', name: '15# Felt 4SQ / 30# Felt 2SQ', category: 'Underlayment', manufacturer: 'Generic', sku: 'FELT-1530', unit: 'roll', price: 22.98, description: '15# felt (4SQ) or 30# felt (2SQ) per roll.', colors: [], in_stock: true, coverage_per_unit: '200-400 sq ft' },
  { id: 'srs-under-005', name: 'GAF FeltBuster 10SQ', category: 'Underlayment', manufacturer: 'GAF', sku: 'GAF-FB-10', unit: 'roll', price: 99.68, description: 'Synthetic underlayment. 10SQ roll.', colors: [], in_stock: true, coverage_per_unit: '1000 sq ft' },
  { id: 'srs-under-006', name: 'GAF Tiger Paw 10SQ', category: 'Underlayment', manufacturer: 'GAF', sku: 'GAF-TP-10', unit: 'roll', price: 191.01, description: 'Premium synthetic underlayment with enhanced traction. 10SQ roll.', colors: [], in_stock: true, coverage_per_unit: '1000 sq ft' },
  { id: 'srs-under-007', name: 'GAF Deck Armor 10SQ', category: 'Underlayment', manufacturer: 'GAF', sku: 'GAF-DA-10', unit: 'roll', price: 296.02, description: 'Premium breathable underlayment. 10SQ roll.', colors: [], in_stock: true, coverage_per_unit: '1000 sq ft' },
  { id: 'srs-under-008', name: 'CertainTeed RoofRunner 10SQ', category: 'Underlayment', manufacturer: 'CertainTeed', sku: 'CT-RR-10', unit: 'roll', price: 96.00, description: 'Synthetic underlayment. 10SQ roll.', colors: [], in_stock: true, coverage_per_unit: '1000 sq ft' },
  { id: 'srs-under-009', name: 'OC ProArmor Underlayment 10SQ', category: 'Underlayment', manufacturer: 'Owens Corning', sku: 'OC-PA-10', unit: 'roll', price: 114.11, description: 'Synthetic underlayment. 10SQ roll.', colors: [], in_stock: true, coverage_per_unit: '1000 sq ft' },
  { id: 'srs-under-010', name: 'Atlas Summit 60 10SQ', category: 'Underlayment', manufacturer: 'Atlas', sku: 'ATL-S60-10', unit: 'roll', price: 83.97, description: 'Synthetic underlayment. 10SQ roll.', colors: [], in_stock: true, coverage_per_unit: '1000 sq ft' },
  { id: 'srs-under-011', name: 'Eco Chief Solarhide 10SQ', category: 'Underlayment', manufacturer: 'Eco Chief', sku: 'EC-SH-10', unit: 'roll', price: 325.00, description: 'Solar reflective underlayment. 10SQ roll.', colors: [], in_stock: true, coverage_per_unit: '1000 sq ft' },
  // --- Ice & Water Shield ---
  { id: 'srs-iws-001', name: 'GAF StormGuard I&W 2SQ', category: 'Ice & Water Shield', manufacturer: 'GAF', sku: 'GAF-SG-2', unit: 'roll', price: 105.75, description: 'Self-adhering ice & water shield. 2SQ roll.', colors: [], in_stock: true, coverage_per_unit: '200 sq ft' },
  { id: 'srs-iws-002', name: 'MFM IB3 Ice Buster SA 2SQ', category: 'Ice & Water Shield', manufacturer: 'MFM', sku: 'MFM-IB3-2', unit: 'roll', price: 72.03, description: 'Self-adhering ice & water barrier. 2SQ roll.', colors: [], in_stock: true, coverage_per_unit: '200 sq ft' },
  { id: 'srs-iws-003', name: 'Carlisle WIP 300 High Temp 2SQ', category: 'Ice & Water Shield', manufacturer: 'Carlisle', sku: 'CAR-WIP300-2', unit: 'roll', price: 130.00, description: 'High-temperature self-adhering membrane. 2SQ roll.', colors: [], in_stock: true, coverage_per_unit: '200 sq ft' },
  { id: 'srs-iws-004', name: 'Carlisle WIP 250 High Temp 2SQ', category: 'Ice & Water Shield', manufacturer: 'Carlisle', sku: 'CAR-WIP250-2', unit: 'roll', price: 106.50, description: 'High-temperature self-adhering membrane. 2SQ roll.', colors: [], in_stock: true, coverage_per_unit: '200 sq ft' },
  { id: 'srs-iws-005', name: 'OC WeatherLock I&W 2SQ', category: 'Ice & Water Shield', manufacturer: 'Owens Corning', sku: 'OC-WL-2', unit: 'roll', price: 115.04, description: 'Self-adhering ice & water shield. 2SQ roll.', colors: [], in_stock: true, coverage_per_unit: '200 sq ft' },
  { id: 'srs-iws-006', name: 'CertainTeed WinterGuard I&W 2SQ', category: 'Ice & Water Shield', manufacturer: 'CertainTeed', sku: 'CT-WG-2', unit: 'roll', price: 99.64, description: 'Self-adhering ice & water shield. 2SQ roll.', colors: [], in_stock: true, coverage_per_unit: '200 sq ft' },
  { id: 'srs-iws-007', name: 'Atlas WeatherMaster I&W', category: 'Ice & Water Shield', manufacturer: 'Atlas', sku: 'ATL-WM-IW', unit: 'roll', price: 95.41, description: 'Self-adhering ice & water shield.', colors: [], in_stock: true, coverage_per_unit: '200 sq ft' },
  // --- Ventilation ---
  { id: 'srs-vent-001', name: 'Lomanco 12" Turbine Vent', category: 'Ventilation', manufacturer: 'Lomanco', sku: 'LOM-12T-VENT', unit: 'each', price: 79.73, description: 'Wind-driven turbine vent. 12" diameter.', colors: [], in_stock: true },
  { id: 'srs-vent-002', name: 'Lomanco 550 Low Profile Vent', category: 'Ventilation', manufacturer: 'Lomanco', sku: 'LOM-550-LP', unit: 'each', price: 17.04, description: 'Low-profile static roof vent.', colors: [], in_stock: true },
  { id: 'srs-vent-003', name: 'Lomanco 750 Slant Back Vent', category: 'Ventilation', manufacturer: 'Lomanco', sku: 'LOM-750-SB', unit: 'each', price: 19.74, description: 'Slant back static roof vent.', colors: [], in_stock: true },
  { id: 'srs-vent-004', name: 'Lomanco 750 Slant Back GALV', category: 'Ventilation', manufacturer: 'Lomanco', sku: 'LOM-750G-SB', unit: 'each', price: 22.00, description: 'Galvanized slant back vent.', colors: [], in_stock: true },
  { id: 'srs-vent-005', name: 'Butler VX25 Static Dome Vent', category: 'Ventilation', manufacturer: 'Butler', sku: 'BUT-VX25-DOME', unit: 'each', price: 43.37, description: 'Static dome vent.', colors: [], in_stock: true },
  { id: 'srs-vent-006', name: 'GAF Cobra 9"/12" Ridge Vent', category: 'Ventilation', manufacturer: 'GAF', sku: 'GAF-COBRA-RV', unit: 'each', price: 14.71, description: 'Cobra ridge vent. 4\' section.', colors: [], in_stock: true },
  { id: 'srs-vent-007', name: 'GAF SSB960A Slant Back Vent', category: 'Ventilation', manufacturer: 'GAF', sku: 'GAF-SSB960A', unit: 'each', price: 19.58, description: 'GAF slant back vent.', colors: [], in_stock: true },
  { id: 'srs-vent-008', name: 'Attic Breeze 35W Solar Vent', category: 'Ventilation', manufacturer: 'Attic Breeze', sku: 'AB-35W-SOL', unit: 'each', price: 590.21, description: '35W solar-powered attic vent.', colors: [], in_stock: true },
  { id: 'srs-vent-009', name: 'Attic Breeze 45W Solar Vent', category: 'Ventilation', manufacturer: 'Attic Breeze', sku: 'AB-45W-SOL', unit: 'each', price: 657.86, description: '45W solar-powered attic vent.', colors: [], in_stock: true },
  { id: 'srs-vent-010', name: 'Butler VX2414AM Power Vent', category: 'Ventilation', manufacturer: 'Butler', sku: 'BUT-VX2414', unit: 'each', price: 95.33, description: 'Electric power attic vent.', colors: [], in_stock: true },
  { id: 'srs-vent-011', name: 'GAF ERV5 Power Vent', category: 'Ventilation', manufacturer: 'GAF', sku: 'GAF-ERV5', unit: 'each', price: 122.70, description: 'GAF electric power vent.', colors: [], in_stock: true },
  { id: 'srs-vent-012', name: 'CertainTeed 12" Ridge Vent', category: 'Ventilation', manufacturer: 'CertainTeed', sku: 'CT-12-RV', unit: 'each', price: 15.97, description: 'CertainTeed unfiltered ridge vent. 4\' section.', colors: [], in_stock: true },
  { id: 'srs-vent-013', name: 'OC VentSure Ridge Vent', category: 'Ventilation', manufacturer: 'Owens Corning', sku: 'OC-VS-RV', unit: 'each', price: 17.68, description: 'VentSure ridge vent. 4\' section.', colors: [], in_stock: true },
  { id: 'srs-vent-014', name: 'Atlas TruRidge', category: 'Ventilation', manufacturer: 'Atlas', sku: 'ATL-TR-RV', unit: 'each', price: 13.90, description: 'Atlas ridge vent. 4\' section.', colors: [], in_stock: true },
  { id: 'srs-vent-015', name: 'Lomanco OmniRidge Vent 11"', category: 'Ventilation', manufacturer: 'Lomanco', sku: 'LOM-OR4-11', unit: 'each', price: 12.64, description: 'OmniRidge vent 11" wide.', colors: [], in_stock: true },
  { id: 'srs-vent-016', name: '4" Bath/Dryer Vent Black Steel', category: 'Ventilation', manufacturer: 'Generic', sku: 'GEN-4BD-VENT', unit: 'each', price: 28.67, description: '4" bath/dryer vent, black steel.', colors: [], in_stock: true },
  { id: 'srs-vent-017', name: '4" DryerJack Vent', category: 'Ventilation', manufacturer: 'DryerJack', sku: 'DJ-4-VENT', unit: 'each', price: 36.50, description: '4" low-profile dryer exhaust vent.', colors: [], in_stock: true },
  { id: 'srs-vent-018', name: '6" DryerJack Vent', category: 'Ventilation', manufacturer: 'DryerJack', sku: 'DJ-6-VENT', unit: 'each', price: 40.15, description: '6" low-profile dryer exhaust vent.', colors: [], in_stock: true },
  // --- Metal / Flashing ---
  { id: 'srs-metal-001', name: '1.5"x1.5" Painted Drip Edge (Embossed)', category: 'Flashing & Metals', manufacturer: 'Generic', sku: 'GEN-15DE-PE', unit: 'each', price: 5.55, description: '1.5"x1.5" painted embossed drip edge. 10\' piece.', colors: [], in_stock: true },
  { id: 'srs-metal-002', name: '2"x2" Painted Drip Edge (Embossed)', category: 'Flashing & Metals', manufacturer: 'Generic', sku: 'GEN-2DE-PE', unit: 'each', price: 6.95, description: '2"x2" painted embossed drip edge. 10\' piece.', colors: [], in_stock: true },
  { id: 'srs-metal-003', name: '2"x2" Painted Drip Edge (Smooth)', category: 'Flashing & Metals', manufacturer: 'Generic', sku: 'GEN-2DE-PS', unit: 'each', price: 6.95, description: '2"x2" painted smooth drip edge. 10\' piece.', colors: [], in_stock: true },
  { id: 'srs-metal-004', name: '1.5"x1.5" Mill Drip Edge', category: 'Flashing & Metals', manufacturer: 'Generic', sku: 'GEN-15DE-M', unit: 'each', price: 4.75, description: '1.5"x1.5" mill finish drip edge. 10\' piece.', colors: [], in_stock: true },
  { id: 'srs-metal-005', name: '2"x2" Mill Drip Edge', category: 'Flashing & Metals', manufacturer: 'Generic', sku: 'GEN-2DE-M', unit: 'roll', price: 5.95, description: '2"x2" mill finish drip edge.', colors: [], in_stock: true },
  { id: 'srs-metal-006', name: '20"x50\' Valley Metal Roll', category: 'Flashing & Metals', manufacturer: 'Generic', sku: 'GEN-VAL-2050', unit: 'roll', price: 64.98, description: 'Pre-bent valley metal. 20" wide x 50\' long.', colors: [], in_stock: true },
  { id: 'srs-metal-007', name: '4"x4"x8" Step Flashing (100/bdl)', category: 'Flashing & Metals', manufacturer: 'Generic', sku: 'GEN-STEP-448', unit: 'bundle', price: 59.48, description: 'Step flashing. 100 pieces per bundle.', colors: [], in_stock: true },
  { id: 'srs-metal-008', name: '4"x5"x10\' Headwall Flashing', category: 'Flashing & Metals', manufacturer: 'Generic', sku: 'GEN-HW-4510', unit: 'each', price: 18.59, description: 'Headwall flashing. 10\' piece.', colors: [], in_stock: true },
  { id: 'srs-metal-009', name: '4"x5"x10\' Turnback Flashing', category: 'Flashing & Metals', manufacturer: 'Generic', sku: 'GEN-TB-4510', unit: 'each', price: 18.87, description: 'Turnback flashing. 10\' piece.', colors: [], in_stock: true },
  // --- Pipe Boots / Leads ---
  { id: 'srs-boot-001', name: '3n1 Pipe Boot', category: 'Pipe Boots', manufacturer: 'Generic', sku: 'GEN-3N1-PB', unit: 'each', price: 6.85, description: '3-in-1 standard pipe boot.', colors: [], in_stock: true },
  { id: 'srs-boot-002', name: '4" Pipe Boot', category: 'Pipe Boots', manufacturer: 'Generic', sku: 'GEN-4-PB', unit: 'each', price: 10.71, description: 'Standard 4" pipe boot.', colors: [], in_stock: true },
  { id: 'srs-boot-003', name: '0"-5-3/8" Split Boot', category: 'Pipe Boots', manufacturer: 'Generic', sku: 'GEN-SPLIT-PB', unit: 'each', price: 39.70, description: 'Split pipe boot for retrofit. 0"-5-3/8".', colors: [], in_stock: true },
  { id: 'srs-boot-004', name: '1.5" Lead 2.5#', category: 'Pipe Boots', manufacturer: 'Generic', sku: 'GEN-15L-PB', unit: 'each', price: 18.27, description: '1.5" lead pipe flashing. 2.5 lb.', colors: [], in_stock: true },
  { id: 'srs-boot-005', name: '2" Lead 2.5#', category: 'Pipe Boots', manufacturer: 'Generic', sku: 'GEN-2L-PB', unit: 'each', price: 19.56, description: '2" lead pipe flashing. 2.5 lb.', colors: [], in_stock: true },
  { id: 'srs-boot-006', name: '3" Lead 2.5#', category: 'Pipe Boots', manufacturer: 'Generic', sku: 'GEN-3L-PB', unit: 'each', price: 25.69, description: '3" lead pipe flashing. 2.5 lb.', colors: [], in_stock: true },
  { id: 'srs-boot-007', name: '4" Lead 2.5#', category: 'Pipe Boots', manufacturer: 'Generic', sku: 'GEN-4L-PB', unit: 'each', price: 34.25, description: '4" lead pipe flashing. 2.5 lb.', colors: [], in_stock: true },
  { id: 'srs-boot-008', name: '1.5" Bullet Boot', category: 'Pipe Boots', manufacturer: 'Bullet', sku: 'BUL-15-BB', unit: 'each', price: 16.00, description: '1.5" rubber bullet pipe boot.', colors: [], in_stock: true },
  { id: 'srs-boot-009', name: '2" Bullet Boot', category: 'Pipe Boots', manufacturer: 'Bullet', sku: 'BUL-2-BB', unit: 'each', price: 18.00, description: '2" rubber bullet pipe boot.', colors: [], in_stock: true },
  { id: 'srs-boot-010', name: '3" Bullet Boot', category: 'Pipe Boots', manufacturer: 'Bullet', sku: 'BUL-3-BB', unit: 'each', price: 20.00, description: '3" rubber bullet pipe boot.', colors: [], in_stock: true },
  { id: 'srs-boot-011', name: '4" Bullet Boot', category: 'Pipe Boots', manufacturer: 'Bullet', sku: 'BUL-4-BB', unit: 'each', price: 34.95, description: '4" rubber bullet pipe boot.', colors: [], in_stock: true },
  // --- HVAC ---
  { id: 'srs-hvac-001', name: '3" HVAC Cap/Collar/Base Combo', category: 'Ventilation', manufacturer: 'Generic', sku: 'GEN-3HVAC', unit: 'each', price: 26.22, description: '3" HVAC cap, collar, and base combo.', colors: [], in_stock: true },
  { id: 'srs-hvac-002', name: '4" HVAC Cap/Collar/Base Combo', category: 'Ventilation', manufacturer: 'Generic', sku: 'GEN-4HVAC', unit: 'each', price: 35.41, description: '4" HVAC cap, collar, and base combo.', colors: [], in_stock: true },
  { id: 'srs-hvac-003', name: '5" HVAC Cap/Collar/Base Combo', category: 'Ventilation', manufacturer: 'Generic', sku: 'GEN-5HVAC', unit: 'each', price: 46.84, description: '5" HVAC cap, collar, and base combo.', colors: [], in_stock: true },
  { id: 'srs-hvac-004', name: '6" HVAC Cap/Collar/Base Combo', category: 'Ventilation', manufacturer: 'Generic', sku: 'GEN-6HVAC', unit: 'each', price: 55.74, description: '6" HVAC cap, collar, and base combo.', colors: [], in_stock: true },
  { id: 'srs-hvac-005', name: '6-4" Roof Jack w/ Cap (4-6/12)', category: 'Ventilation', manufacturer: 'Generic', sku: 'GEN-RJ64', unit: 'each', price: 31.14, description: '6-4" roof jack with cap. 4-6/12 pitch.', colors: [], in_stock: true },
  { id: 'srs-hvac-006', name: '8-6" Roof Jack w/ Cap (4-6/12)', category: 'Ventilation', manufacturer: 'Generic', sku: 'GEN-RJ86', unit: 'each', price: 35.17, description: '8-6" roof jack with cap. 4-6/12 pitch.', colors: [], in_stock: true },
  { id: 'srs-hvac-007', name: '2-7/8"-5" Versa Cap', category: 'Ventilation', manufacturer: 'Generic', sku: 'GEN-VC-SM', unit: 'each', price: 35.00, description: '2-7/8" to 5" versa cap.', colors: [], in_stock: true },
  { id: 'srs-hvac-008', name: '4-7/8"-7" Versa Cap', category: 'Ventilation', manufacturer: 'Generic', sku: 'GEN-VC-LG', unit: 'each', price: 43.25, description: '4-7/8" to 7" versa cap.', colors: [], in_stock: true },
  // --- Fasteners ---
  { id: 'srs-fast-001', name: '1" Plastic Caps (2000/box)', category: 'Fasteners', manufacturer: 'Generic', sku: 'GEN-1PC-2K', unit: 'box', price: 18.00, description: '1" plastic caps. 2000 per box.', colors: [], in_stock: true },
  { id: 'srs-fast-002', name: '1-1/4" Coil Nails (7200/box)', category: 'Fasteners', manufacturer: 'Generic', sku: 'GEN-125CN-7K', unit: 'box', price: 49.95, description: '1-1/4" coil roofing nails. 7200 per box.', colors: [], in_stock: true },
  { id: 'srs-fast-003', name: '3/4" Coil Nails', category: 'Fasteners', manufacturer: 'Generic', sku: 'GEN-75CN', unit: 'box', price: 56.00, description: '3/4" coil roofing nails.', colors: [], in_stock: true },
  { id: 'srs-fast-004', name: '3/8" Staples', category: 'Fasteners', manufacturer: 'Generic', sku: 'GEN-38ST', unit: 'box', price: 7.99, description: '3/8" roofing staples.', colors: [], in_stock: true },
  // --- Accessories / Sealants ---
  { id: 'srs-acc-001', name: 'NP-1 Caulk', category: 'Accessories', manufacturer: 'Sonneborn', sku: 'SON-NP1', unit: 'each', price: 7.71, description: 'NP-1 polyurethane sealant.', colors: [], in_stock: true },
  { id: 'srs-acc-002', name: 'NP-1 25 Clear', category: 'Accessories', manufacturer: 'Sonneborn', sku: 'SON-NP125C', unit: 'each', price: 7.95, description: 'NP-1 25 clear sealant.', colors: [], in_stock: true },
  { id: 'srs-acc-003', name: 'Geocel Spray Paint', category: 'Accessories', manufacturer: 'Geocel', sku: 'GEO-SP', unit: 'each', price: 8.50, description: 'Touch-up spray paint for roofing.', colors: [], in_stock: true },
  { id: 'srs-acc-004', name: 'Geocel 2300 Clear', category: 'Accessories', manufacturer: 'Geocel', sku: 'GEO-2300C', unit: 'each', price: 8.69, description: 'Clear tripolymer sealant.', colors: [], in_stock: true },
  { id: 'srs-acc-005', name: 'Duralink 35 Caulk', category: 'Accessories', manufacturer: 'Pecora', sku: 'PEC-DL35', unit: 'each', price: 7.71, description: 'High-performance sealant.', colors: [], in_stock: true },
  { id: 'srs-acc-006', name: 'Titebond Ult-MP Caulk', category: 'Accessories', manufacturer: 'Titebond', sku: 'TB-UMP', unit: 'each', price: 8.34, description: 'Ultimate multi-purpose caulk.', colors: [], in_stock: true },
  // --- Modified Bitumen ---
  { id: 'srs-mod-001', name: 'CT Flintlastic GTA/APP 1SQ', category: 'Modified Bitumen', manufacturer: 'CertainTeed', sku: 'CT-FGTA-1', unit: 'roll', price: 87.54, description: 'Modified bitumen cap sheet. 1SQ roll.', colors: [], in_stock: true, coverage_per_unit: '100 sq ft' },
  { id: 'srs-mod-002', name: 'CT Flintlastic STA/APP 1SQ', category: 'Modified Bitumen', manufacturer: 'CertainTeed', sku: 'CT-FSTA-1', unit: 'roll', price: 88.81, description: 'Modified bitumen smooth cap sheet. 1SQ roll.', colors: [], in_stock: true, coverage_per_unit: '100 sq ft' },
  { id: 'srs-mod-003', name: 'CT Flintlastic SA Cap Sheet 1SQ', category: 'Modified Bitumen', manufacturer: 'CertainTeed', sku: 'CT-FSAC-1', unit: 'roll', price: 117.85, description: 'Self-adhering cap sheet. 1SQ roll.', colors: [], in_stock: true, coverage_per_unit: '100 sq ft' },
  { id: 'srs-mod-004', name: 'CT Glass Base Sheet 3SQ', category: 'Modified Bitumen', manufacturer: 'CertainTeed', sku: 'CT-GBS-3', unit: 'roll', price: 57.86, description: 'Glass base sheet. 3SQ roll.', colors: [], in_stock: true, coverage_per_unit: '300 sq ft' },
  { id: 'srs-mod-005', name: 'CT Black Diamond Base 2SQ', category: 'Modified Bitumen', manufacturer: 'CertainTeed', sku: 'CT-BDB-2', unit: 'roll', price: 119.83, description: 'Black Diamond base sheet. 2SQ roll.', colors: [], in_stock: true, coverage_per_unit: '200 sq ft' },
  { id: 'srs-mod-006', name: 'CT Flintlastic SA Nailbase 2SQ', category: 'Modified Bitumen', manufacturer: 'CertainTeed', sku: 'CT-FSAN-2', unit: 'roll', price: 109.57, description: 'Self-adhering nailbase sheet. 2SQ roll.', colors: [], in_stock: true, coverage_per_unit: '200 sq ft' },
  { id: 'srs-mod-007', name: 'CT Flintlastic SA Plybase 2SQ', category: 'Modified Bitumen', manufacturer: 'CertainTeed', sku: 'CT-FSAP-2', unit: 'roll', price: 123.79, description: 'Self-adhering ply base sheet. 2SQ roll.', colors: [], in_stock: true, coverage_per_unit: '200 sq ft' },
  { id: 'srs-mod-008', name: 'CT Flintbond SA Mod Bit Tube', category: 'Modified Bitumen', manufacturer: 'CertainTeed', sku: 'CT-FB-TUBE', unit: 'each', price: 7.96, description: 'Mod bit adhesive tube.', colors: [], in_stock: true },
  { id: 'srs-mod-009', name: 'Karnak 108 Asph. Spray Primer', category: 'Modified Bitumen', manufacturer: 'Karnak', sku: 'KAR-108-SP', unit: 'each', price: 15.44, description: 'Asphalt spray primer.', colors: [], in_stock: true },
  { id: 'srs-mod-010', name: 'CT 1GAL Flintprime QD', category: 'Modified Bitumen', manufacturer: 'CertainTeed', sku: 'CT-FPQD-1', unit: 'each', price: 19.10, description: '1 gallon quick-dry primer.', colors: [], in_stock: true },
  { id: 'srs-mod-011', name: 'CT 3GAL Flintbond Mod Bit Adhesive', category: 'Modified Bitumen', manufacturer: 'CertainTeed', sku: 'CT-FBMB-3', unit: 'each', price: 58.36, description: '3 gallon mod bit adhesive.', colors: [], in_stock: true },
  { id: 'srs-mod-012', name: 'Tropical 216 Mod Bit Adhesive 5GAL', category: 'Modified Bitumen', manufacturer: 'Tropical', sku: 'TRP-216-5', unit: 'each', price: 68.84, description: '5 gallon mod bit adhesive.', colors: [], in_stock: true },
  // --- Coatings ---
  { id: 'srs-coat-001', name: 'GacoRoof 5GAL Silicone White/Gray', category: 'Coatings', manufacturer: 'Gaco', sku: 'GACO-5G-WG', unit: 'each', price: 329.20, description: '5 gallon silicone roof coating. White or gray.', colors: ['White', 'Gray'], in_stock: true },
  { id: 'srs-coat-002', name: 'GacoRoof 1GAL Silicone White/Gray', category: 'Coatings', manufacturer: 'Gaco', sku: 'GACO-1G-WG', unit: 'each', price: 80.67, description: '1 gallon silicone roof coating. White or gray.', colors: ['White', 'Gray'], in_stock: true },
  { id: 'srs-coat-003', name: 'Karnak 5GAL ElastBrite Acrylic', category: 'Coatings', manufacturer: 'Karnak', sku: 'KAR-501-5', unit: 'each', price: 155.32, description: '5 gallon 501 ElastBrite acrylic roof coating.', colors: [], in_stock: true },
  // --- Delivery ---
  { id: 'srs-del-001', name: 'Ground Drop Delivery', category: 'Delivery', manufacturer: 'SRS', sku: 'SRS-GRD-DROP', unit: 'each', price: 80.00, description: 'Ground-level material delivery.', colors: [], in_stock: true },
  { id: 'srs-del-002', name: 'Roof Load Delivery', category: 'Delivery', manufacturer: 'SRS', sku: 'SRS-ROOF-LOAD', unit: 'each', price: 100.00, description: 'Rooftop material delivery. Crane load available.', colors: [], in_stock: true },
];

const _OLD_REMOVED = [{
    id: 'SKIP',
    name: 'SKIP',
    category: 'SKIP',
    manufacturer: 'Owens Corning',
    sku: 'OC-DUR-STORM',
    unit: 'bundle',
    price: 52.25,
    description: 'Class 4 impact-resistant architectural shingle. SureNail Technology. Best for hail-prone areas. Limited lifetime warranty.',
    colors: ['Onyx Black', 'Estate Gray', 'Driftwood', 'Brownwood', 'Teak'],
    in_stock: true,
    coverage_per_unit: '33.3 sq ft',
    weight_per_unit: '78 lbs',
  },
  {
    id: 'srs-shingle-005',
    name: 'GAF Timberline AS II',
    category: 'Shingles',
    manufacturer: 'GAF',
    sku: 'GAF-TASII-IR',
    unit: 'bundle',
    price: 49.50,
    description: 'Class 4 impact-resistant with ArmorShield technology. StainGuard Plus. Ideal for storm-damaged roof replacements.',
    colors: ['Charcoal', 'Pewter Gray', 'Weathered Wood', 'Barkwood', 'Slate'],
    in_stock: false,
    coverage_per_unit: '33.3 sq ft',
    weight_per_unit: '75 lbs',
  },

  // --- Underlayment ---
  {
    id: 'srs-under-001',
    name: 'GAF FeltBuster Synthetic Underlayment',
    category: 'Underlayment',
    manufacturer: 'GAF',
    sku: 'GAF-FB-SYN-10',
    unit: 'roll',
    price: 68.00,
    description: '10-square roll synthetic underlayment. Skid-resistant surface. UV stable for up to 6 months exposure. 48" x 250\'.',
    colors: [],
    in_stock: true,
    coverage_per_unit: '1000 sq ft',
    weight_per_unit: '42 lbs',
  },
  {
    id: 'srs-under-002',
    name: 'Owens Corning ProArmor Synthetic',
    category: 'Underlayment',
    manufacturer: 'Owens Corning',
    sku: 'OC-PA-SYN-10',
    unit: 'roll',
    price: 72.50,
    description: 'Premium synthetic underlayment. Anti-slip walking surface. 180-day UV exposure rating. 48" x 250\'.',
    colors: [],
    in_stock: true,
    coverage_per_unit: '1000 sq ft',
    weight_per_unit: '40 lbs',
  },
  {
    id: 'srs-under-003',
    name: '#30 Felt Underlayment',
    category: 'Underlayment',
    manufacturer: 'Tarco',
    sku: 'TAR-30FELT-2',
    unit: 'roll',
    price: 28.50,
    description: 'Traditional #30 organic felt underlayment. 2-square roll. 36" x 72\'. ASTM D4869 Type IV compliant.',
    colors: [],
    in_stock: true,
    coverage_per_unit: '200 sq ft',
    weight_per_unit: '60 lbs',
  },

  // --- Flashing & Metals ---
  {
    id: 'srs-flash-001',
    name: 'Step Flashing - Galvanized',
    category: 'Flashing',
    manufacturer: 'Amerimax',
    sku: 'AMX-SF-GALV',
    unit: 'box',
    price: 34.75,
    description: 'Pre-bent galvanized step flashing. 4" x 4" x 8". 100 pieces per box. 26 gauge galvanized steel.',
    colors: [],
    in_stock: true,
    coverage_per_unit: '100 pieces',
    weight_per_unit: '18 lbs',
  },
  {
    id: 'srs-flash-002',
    name: 'Drip Edge - Aluminum 2" x 2"',
    category: 'Flashing',
    manufacturer: 'Amerimax',
    sku: 'AMX-DE-ALU-10',
    unit: 'each',
    price: 8.25,
    description: 'Aluminum drip edge flashing. 2" x 2" x 10\' length. .019 gauge aluminum. Pre-painted finish available.',
    colors: ['White', 'Brown', 'Black', 'Mill Finish'],
    in_stock: true,
    coverage_per_unit: '10 linear ft',
    weight_per_unit: '0.5 lbs',
  },
  {
    id: 'srs-flash-003',
    name: 'Pipe Boot Flashing - 2"',
    category: 'Flashing',
    manufacturer: 'Oatey',
    sku: 'OAT-PB-2IN',
    unit: 'each',
    price: 12.50,
    description: 'Thermoplastic pipe boot flashing for 2" pipe. One-piece design. UV-resistant. Fits 2" to 3" pipe.',
    colors: ['Black'],
    in_stock: true,
    coverage_per_unit: '1 pipe penetration',
    weight_per_unit: '1.2 lbs',
  },
  {
    id: 'srs-flash-004',
    name: 'Valley Metal - W-Style Galvanized',
    category: 'Flashing',
    manufacturer: 'Amerimax',
    sku: 'AMX-VM-WGALV-10',
    unit: 'each',
    price: 18.50,
    description: 'W-style valley flashing. 20" wide x 10\' long. 26 gauge galvanized steel. Pre-formed center crimp.',
    colors: [],
    in_stock: true,
    coverage_per_unit: '10 linear ft',
    weight_per_unit: '5 lbs',
  },

  // --- Ventilation ---
  {
    id: 'srs-vent-001',
    name: 'GAF Cobra Snow Country Ridge Vent',
    category: 'Ventilation',
    manufacturer: 'GAF',
    sku: 'GAF-COBRA-SC-4',
    unit: 'each',
    price: 62.00,
    description: '4\' rigid ridge vent with external baffle. 18 sq in NFA per linear foot. Snow guard built in. Nail gun compatible.',
    colors: [],
    in_stock: true,
    coverage_per_unit: '4 linear ft',
    weight_per_unit: '2 lbs',
  },
  {
    id: 'srs-vent-002',
    name: 'Lomanco Whirlybird Turbine Vent',
    category: 'Ventilation',
    manufacturer: 'Lomanco',
    sku: 'LOM-WB-12IN',
    unit: 'each',
    price: 38.50,
    description: '12" internally braced turbine vent. Wind-driven ventilation. 135 sq in NFA. Galvanized steel construction.',
    colors: ['Mill', 'Black', 'Brown', 'Weatherwood'],
    in_stock: true,
    coverage_per_unit: '1 unit',
    weight_per_unit: '4 lbs',
  },
  {
    id: 'srs-vent-003',
    name: 'Soffit Intake Vent - Aluminum',
    category: 'Ventilation',
    manufacturer: 'Air Vent',
    sku: 'AV-SIV-8X16',
    unit: 'each',
    price: 6.75,
    description: '8" x 16" aluminum soffit intake vent. 50 sq in NFA. Insect screen included. For use in soffit panels.',
    colors: ['White', 'Brown', 'Black', 'Mill'],
    in_stock: true,
    coverage_per_unit: '1 unit',
    weight_per_unit: '0.3 lbs',
  },

  // --- Accessories ---
  {
    id: 'srs-acc-001',
    name: 'Coil Roofing Nails 1-1/4"',
    category: 'Accessories',
    manufacturer: 'Grip-Rite',
    sku: 'GR-CRN-114-7200',
    unit: 'box',
    price: 52.00,
    description: 'Electro-galvanized coil roofing nails. 1-1/4" length. 0.120" shank. 7,200 nails per box. For pneumatic nailers.',
    colors: [],
    in_stock: true,
    coverage_per_unit: '7200 nails',
    weight_per_unit: '30 lbs',
  },
  {
    id: 'srs-acc-002',
    name: 'Roofing Sealant - Geocel Pro Flex',
    category: 'Accessories',
    manufacturer: 'Geocel',
    sku: 'GEO-PF-BLK-10',
    unit: 'each',
    price: 7.25,
    description: 'Premium tripolymer sealant. 10.3 oz cartridge. UV and weather resistant. Paintable. 50-year durability.',
    colors: ['Black', 'Clear', 'White'],
    in_stock: true,
    coverage_per_unit: '1 cartridge',
    weight_per_unit: '0.7 lbs',
  },
  {
    id: 'srs-acc-003',
    name: 'Starter Strip Shingles',
    category: 'Accessories',
    manufacturer: 'GAF',
    sku: 'GAF-SS-PRO-ST',
    unit: 'bundle',
    price: 24.50,
    description: 'Pro-Start starter strip shingles. Pre-cut for fast installation. Sealant strip for wind resistance. 120 linear ft per bundle.',
    colors: [],
    in_stock: true,
    coverage_per_unit: '120 linear ft',
    weight_per_unit: '22 lbs',
  },
  {
    id: 'srs-acc-004',
    name: 'Hip & Ridge Cap Shingles',
    category: 'Accessories',
    manufacturer: 'Owens Corning',
    sku: 'OC-HRC-DECRA',
    unit: 'bundle',
    price: 58.75,
    description: 'DecoRidge hip & ridge cap shingles. High-profile appearance. 20 linear ft per bundle. Color-matched to Duration shingles.',
    colors: ['Onyx Black', 'Estate Gray', 'Driftwood', 'Brownwood', 'Teak'],
    in_stock: true,
    coverage_per_unit: '20 linear ft',
    weight_per_unit: '25 lbs',
  },

  // --- Ice & Water Shield ---
  {
    id: 'srs-iws-001',
    name: 'GAF WeatherWatch Ice & Water Shield',
    category: 'Ice & Water Shield',
    manufacturer: 'GAF',
    sku: 'GAF-WW-IWS-2',
    unit: 'roll',
    price: 85.00,
    description: 'Mineral-surfaced ice & water barrier. 2-square roll (200 sq ft). Self-sealing membrane. Meets IRC code requirements.',
    colors: [],
    in_stock: true,
    coverage_per_unit: '200 sq ft',
    weight_per_unit: '65 lbs',
  },
  {
    id: 'srs-iws-002',
    name: 'Owens Corning WeatherLock G Ice & Water',
    category: 'Ice & Water Shield',
    manufacturer: 'Owens Corning',
    sku: 'OC-WLG-IWS-2',
    unit: 'roll',
    price: 92.00,
    description: 'Granule-surface self-adhering ice and water barrier. 2-square roll. Split-back release film. ICC-ES evaluated.',
    colors: [],
    in_stock: true,
    coverage_per_unit: '200 sq ft',
    weight_per_unit: '62 lbs',
  },
  {
    id: 'srs-iws-003',
    name: 'CertainTeed WinterGuard HT',
    category: 'Ice & Water Shield',
    manufacturer: 'CertainTeed',
    sku: 'CT-WGHT-IWS',
    unit: 'roll',
    price: 88.50,
    description: 'High-temperature self-adhering waterproofing membrane. For high-heat climates. 200 sq ft per roll.',
    colors: [],
    in_stock: true,
    coverage_per_unit: '200 sq ft',
    weight_per_unit: '60 lbs',
  },
]; // end _OLD_REMOVED — unused

// ============================================================
// SRS BRANCHES (Texas)
// ============================================================

const MOCK_BRANCHES = [
  {
    id: 'srs-branch-sat',
    name: 'SRS San Antonio',
    address: '8503 Fourwinds Dr, San Antonio, TX 78239',
    phone: '(210) 590-3899',
    hours: 'Mon-Fri 6:00 AM - 4:00 PM, Sat 7:00 AM - 12:00 PM',
    lat: 29.4907,
    lng: -98.3936,
    distance_miles: null,
  },
  {
    id: 'srs-branch-aus-south',
    name: 'SRS South Austin',
    address: '4301 Supply Court, Austin, TX 78744',
    phone: '(512) 836-1531',
  },
  {
    id: 'srs-branch-rr',
    name: 'SRS Round Rock',
    address: '508 E. McNeil Road, Round Rock, TX 78681',
    phone: '(512) 492-8878',
    hours: 'Mon-Fri 6:00 AM - 4:00 PM, Sat 7:00 AM - 12:00 PM',
    lat: 30.4433,
    lng: -97.6298,
    distance_miles: null,
  },
  {
    id: 'srs-branch-hou',
    name: 'SRS Houston North',
    address: '4830 Director St, Houston, TX 77092',
    phone: '(713) 688-3377',
    hours: 'Mon-Fri 6:00 AM - 4:30 PM, Sat 7:00 AM - 12:00 PM',
    lat: 29.8241,
    lng: -95.4624,
    distance_miles: null,
  },
  {
    id: 'srs-branch-dal',
    name: 'SRS Dallas',
    address: '10615 Newkirk St, Dallas, TX 75220',
    phone: '(214) 350-2444',
    hours: 'Mon-Fri 6:00 AM - 4:00 PM, Sat 7:00 AM - 11:00 AM',
    lat: 32.8513,
    lng: -96.8891,
    distance_miles: null,
  },
];

// ============================================================
// ROUTES
// ============================================================

// GET /api/materials/products — search/browse products
router.get('/products', async (req, res, next) => {
  try {
    const { search, category } = req.query;
    let results = [...MOCK_PRODUCTS];

    if (category && category !== 'All') {
      results = results.filter(p => p.category === category);
    }
    if (search) {
      const q = search.toLowerCase();
      results = results.filter(p =>
        p.name.toLowerCase().includes(q) ||
        p.manufacturer.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q)
      );
    }

    // Images will come from distributor API once connected (ABC Supply, SRS, QXO)
    // For now, products have no image_url — cards show category-colored placeholders
    res.json({ products: results, total: results.length });
  } catch (err) {
    next(err);
  }
});

// GET /api/materials/products/:id — product detail
router.get('/products/:id', async (req, res, next) => {
  try {
    const product = MOCK_PRODUCTS.find(p => p.id === req.params.id);
    if (!product) return res.status(404).json({ error: 'Product not found' });
    res.json({ product });
  } catch (err) {
    next(err);
  }
});

// GET /api/materials/branches — nearby SRS branches
router.get('/branches', async (req, res, next) => {
  try {
    res.json({ branches: MOCK_BRANCHES });
  } catch (err) {
    next(err);
  }
});

// POST /api/materials/orders — create a material order
router.post('/orders', async (req, res, next) => {
  try {
    const { items, branch_id, branch_name, estimate_id } = req.body;
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'items array is required' });
    }
    // Array.isArray checks the container; the reduce below dereferences each
    // ELEMENT, so a null entry threw and surfaced as a 500. `items` lands in a
    // JSONB column, which stores any shape verbatim — reject here instead.
    if (items.some((item) => !item || typeof item !== 'object' || Array.isArray(item))) {
      return res.status(400).json({ error: 'each item must be an object' });
    }

    const total_cost = items.reduce((sum, item) => {
      return sum + (Number(item.quantity) || 0) * (Number(item.unit_price) || 0);
    }, 0);

    // Generate a mock SRS order ID
    const srs_order_id = `SRS-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

    const { rows } = await pool.query(
      `INSERT INTO material_orders (tenant_id, estimate_id, srs_order_id, status, items, branch_id, branch_name, total_cost)
       VALUES ($1, $2, $3, 'draft', $4, $5, $6, $7)
       RETURNING *`,
      [
        req.tenantId,
        estimate_id || null,
        srs_order_id,
        JSON.stringify(items),
        branch_id || null,
        branch_name || null,
        total_cost,
      ]
    );

    res.status(201).json(rows[0]);
  } catch (err) {
    next(err);
  }
});

// GET /api/materials/orders — list orders for tenant
router.get('/orders', async (req, res, next) => {
  try {
    const { status, limit = '50', offset = '0' } = req.query;
    let query = `SELECT * FROM material_orders WHERE tenant_id = $1`;
    const params = [req.tenantId];
    let paramIdx = 2;

    if (status) {
      query += ` AND status = $${paramIdx++}`;
      params.push(status);
    }

    query += ` ORDER BY created_at DESC LIMIT $${paramIdx++} OFFSET $${paramIdx++}`;
    params.push(parseInt(limit, 10), parseInt(offset, 10));

    const { rows } = await pool.query(query, params);

    // Get total count
    let countQuery = `SELECT COUNT(*)::int AS total FROM material_orders WHERE tenant_id = $1`;
    const countParams = [req.tenantId];
    if (status) {
      countQuery += ` AND status = $2`;
      countParams.push(status);
    }
    const { rows: countRows } = await pool.query(countQuery, countParams);

    res.json({ orders: rows, total: countRows[0].total });
  } catch (err) {
    next(err);
  }
});

// GET /api/materials/orders/:id — order detail
router.get('/orders/:id', validateId(), async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM material_orders WHERE id = $1 AND tenant_id = $2`,
      [req.params.id, req.tenantId]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Order not found' });
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
});

// POST /api/materials/estimate/:estimateId/auto-order — auto-generate order from estimate
router.post('/estimate/:estimateId/auto-order', validateId('estimateId'), async (req, res, next) => {
  try {
    const { estimateId } = req.params;

    // Fetch the estimate
    const { rows: estRows } = await pool.query(
      `SELECT * FROM estimates WHERE id = $1 AND tenant_id = $2`,
      [estimateId, req.tenantId]
    );
    if (estRows.length === 0) return res.status(404).json({ error: 'Estimate not found' });

    const estimate = estRows[0];
    // line_items is JSONB read straight back from the row, so it can be a
    // non-array (not iterable -> throw) or hold null/non-object elements, and
    // `li.description` below dereferences each one. Real rows already carry this
    // junk (EST-082/EST-083 = [null]), so this is live data, not just fuzzing.
    const lineItems = (Array.isArray(estimate.line_items) ? estimate.line_items : [])
      .filter((li) => li && typeof li === 'object');

    // Match line items to products via keyword matching
    const orderItems = [];
    for (const li of lineItems) {
      const desc = (li.description || '').toLowerCase();
      let matched = MOCK_PRODUCTS.find(p => {
        const pName = p.name.toLowerCase();
        const pCat = p.category.toLowerCase();
        return desc.includes(pName) || pName.includes(desc) ||
          desc.split(/\s+/).some(word => word.length > 3 && pName.includes(word));
      });

      // Fallback: match by category keywords
      if (!matched) {
        if (desc.includes('shingle') || desc.includes('architectural'))
          matched = MOCK_PRODUCTS.find(p => p.id === 'srs-shingle-002');
        else if (desc.includes('underlayment') || desc.includes('felt') || desc.includes('synthetic'))
          matched = MOCK_PRODUCTS.find(p => p.id === 'srs-under-001');
        else if (desc.includes('flash') || desc.includes('drip') || desc.includes('valley'))
          matched = MOCK_PRODUCTS.find(p => p.id === 'srs-flash-002');
        else if (desc.includes('ridge') && desc.includes('vent'))
          matched = MOCK_PRODUCTS.find(p => p.id === 'srs-vent-001');
        else if (desc.includes('nail'))
          matched = MOCK_PRODUCTS.find(p => p.id === 'srs-acc-001');
        else if (desc.includes('starter'))
          matched = MOCK_PRODUCTS.find(p => p.id === 'srs-acc-003');
        else if (desc.includes('hip') || desc.includes('ridge cap'))
          matched = MOCK_PRODUCTS.find(p => p.id === 'srs-acc-004');
        else if (desc.includes('sealant') || desc.includes('caulk'))
          matched = MOCK_PRODUCTS.find(p => p.id === 'srs-acc-002');
        else if (desc.includes('ice') || desc.includes('water shield'))
          matched = MOCK_PRODUCTS.find(p => p.id === 'srs-iws-001');
        else if (desc.includes('vent') || desc.includes('turbine'))
          matched = MOCK_PRODUCTS.find(p => p.id === 'srs-vent-002');
        else if (desc.includes('pipe') || desc.includes('boot'))
          matched = MOCK_PRODUCTS.find(p => p.id === 'srs-flash-003');
      }

      if (matched) {
        orderItems.push({
          product_id: matched.id,
          product_name: matched.name,
          sku: matched.sku,
          quantity: Number(li.quantity) || 1,
          unit: matched.unit,
          unit_price: matched.price,
        });
      }
    }

    if (orderItems.length === 0) {
      return res.status(400).json({ error: 'No estimate line items could be matched to SRS products' });
    }

    const total_cost = orderItems.reduce((sum, item) => sum + item.quantity * item.unit_price, 0);
    const srs_order_id = `SRS-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

    const { rows } = await pool.query(
      `INSERT INTO material_orders (tenant_id, estimate_id, srs_order_id, status, items, total_cost)
       VALUES ($1, $2, $3, 'draft', $4, $5)
       RETURNING *`,
      [req.tenantId, estimateId, srs_order_id, JSON.stringify(orderItems), total_cost]
    );

    res.status(201).json({ order: rows[0], matchedCount: orderItems.length, totalLineItems: lineItems.length });
  } catch (err) {
    next(err);
  }
});

// PUT /api/materials/credentials — save SRS API credentials
router.put('/credentials', async (req, res, next) => {
  try {
    const { srs_api_key, srs_account_id, preferred_branch_id, preferred_branch_name } = req.body;

    const { rows } = await pool.query(
      `INSERT INTO srs_credentials (tenant_id, srs_api_key, srs_account_id, preferred_branch_id, preferred_branch_name)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (tenant_id) DO UPDATE SET
         srs_api_key = COALESCE($2, srs_credentials.srs_api_key),
         srs_account_id = COALESCE($3, srs_credentials.srs_account_id),
         preferred_branch_id = COALESCE($4, srs_credentials.preferred_branch_id),
         preferred_branch_name = COALESCE($5, srs_credentials.preferred_branch_name)
       RETURNING id, tenant_id, preferred_branch_id, preferred_branch_name, created_at`,
      [req.tenantId, srs_api_key || null, srs_account_id || null, preferred_branch_id || null, preferred_branch_name || null]
    );

    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
});

// GET /api/materials/credentials — check if tenant has SRS credentials
router.get('/credentials', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, tenant_id, preferred_branch_id, preferred_branch_name, created_at,
              CASE WHEN srs_api_key IS NOT NULL THEN true ELSE false END AS has_api_key,
              CASE WHEN srs_account_id IS NOT NULL THEN true ELSE false END AS has_account_id
       FROM srs_credentials WHERE tenant_id = $1`,
      [req.tenantId]
    );

    if (rows.length === 0) {
      return res.json({ configured: false });
    }

    res.json({ configured: true, ...rows[0] });
  } catch (err) {
    next(err);
  }
});

export default router;
