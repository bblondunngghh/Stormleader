import { Router } from 'express';
import authenticate from '../middleware/authenticate.js';
import tenantScope from '../middleware/tenantScope.js';
import pool from '../db/pool.js';

const router = Router();
router.use(authenticate);
router.use(tenantScope);

// ============================================================
// MOCK SRS PRODUCT CATALOG
// Structured to match SRS SIPS API response format
// ============================================================

const MOCK_PRODUCTS = [
  // --- Shingles ---
  {
    id: 'srs-shingle-001',
    name: 'Owens Corning Duration',
    category: 'Shingles',
    manufacturer: 'Owens Corning',
    sku: 'OC-DUR-3TAB',
    unit: 'bundle',
    price: 42.50,
    description: 'Architectural shingle with SureNail Technology. Class 4 impact-resistant. Limited lifetime warranty. 130 mph wind warranty.',
    colors: ['Onyx Black', 'Estate Gray', 'Driftwood', 'Brownwood', 'Chateau Green', 'Desert Tan', 'Harbor Blue', 'Sierra Gray', 'Teak', 'Quarry Gray'],
    in_stock: true,
    coverage_per_unit: '33.3 sq ft',
    weight_per_unit: '73 lbs',
  },
  {
    id: 'srs-shingle-002',
    name: 'GAF Timberline HDZ',
    category: 'Shingles',
    manufacturer: 'GAF',
    sku: 'GAF-THDZ-ARCH',
    unit: 'bundle',
    price: 38.75,
    description: 'Americas #1 selling shingle. LayerLock technology. StainGuard Plus algae protection. WindProven limited wind warranty.',
    colors: ['Charcoal', 'Pewter Gray', 'Weathered Wood', 'Barkwood', 'Hickory', 'Shakewood', 'Slate', 'Hunter Green', 'Patriot Red', 'Mission Brown'],
    in_stock: true,
    coverage_per_unit: '33.3 sq ft',
    weight_per_unit: '70 lbs',
  },
  {
    id: 'srs-shingle-003',
    name: 'CertainTeed Landmark',
    category: 'Shingles',
    manufacturer: 'CertainTeed',
    sku: 'CT-LMK-ARCH',
    unit: 'bundle',
    price: 36.90,
    description: 'Dual-layered architectural shingle with Max Def colors. StreakFighter algae-resistant. 110 mph wind warranty.',
    colors: ['Moire Black', 'Georgetown Gray', 'Weathered Wood', 'Driftwood', 'Burnt Sienna', 'Hunter Green', 'Heather Blend', 'Cobblestone Gray', 'Resawn Shake', 'Colonial Slate'],
    in_stock: true,
    coverage_per_unit: '33.3 sq ft',
    weight_per_unit: '68 lbs',
  },
  {
    id: 'srs-shingle-004',
    name: 'Owens Corning Duration STORM',
    category: 'Shingles',
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
];

// ============================================================
// MOCK SRS BRANCHES (Texas)
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
    id: 'srs-branch-aus',
    name: 'SRS Austin',
    address: '1900 E Howard Ln, Pflugerville, TX 78660',
    phone: '(512) 251-0823',
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
router.get('/orders/:id', async (req, res, next) => {
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
router.post('/estimate/:estimateId/auto-order', async (req, res, next) => {
  try {
    const { estimateId } = req.params;

    // Fetch the estimate
    const { rows: estRows } = await pool.query(
      `SELECT * FROM estimates WHERE id = $1 AND tenant_id = $2`,
      [estimateId, req.tenantId]
    );
    if (estRows.length === 0) return res.status(404).json({ error: 'Estimate not found' });

    const estimate = estRows[0];
    const lineItems = estimate.line_items || [];

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
