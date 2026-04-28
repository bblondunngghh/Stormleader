import { Router } from 'express';
import authenticate from '../middleware/authenticate.js';
import tenantScope from '../middleware/tenantScope.js';
import validateId from '../middleware/validateId.js';
import * as estimateService from '../services/estimateService.js';
import pool from '../db/pool.js';

const router = Router();

// ============================================================
// PUBLIC routes (no auth — customer-facing)
// ============================================================

router.get('/public/:token', async (req, res, next) => {
  try {
    const estimate = await estimateService.getEstimateByToken(req.params.token);
    if (!estimate) return res.status(404).json({ error: 'Estimate not found' });
    res.json(estimate);
  } catch (err) {
    next(err);
  }
});

router.post('/public/:token/accept', async (req, res, next) => {
  try {
    const { signer_name, signature_data } = req.body;
    if (!signer_name) return res.status(400).json({ error: 'signer_name required' });
    const estimate = await estimateService.acceptEstimate(req.params.token, signer_name, signature_data || null);
    if (!estimate) return res.status(404).json({ error: 'Estimate not found or already resolved' });
    res.json(estimate);
  } catch (err) {
    next(err);
  }
});

router.post('/public/:token/decline', async (req, res, next) => {
  try {
    const estimate = await estimateService.declineEstimate(req.params.token);
    if (!estimate) return res.status(404).json({ error: 'Estimate not found or already resolved' });
    res.json(estimate);
  } catch (err) {
    next(err);
  }
});

// ============================================================
// AUTHENTICATED routes
// ============================================================

router.use(authenticate);
router.use(tenantScope);

// List estimates
router.get('/', async (req, res, next) => {
  try {
    const { status, lead_id, limit = '50', offset = '0' } = req.query;
    const result = await estimateService.getEstimates(req.tenantId, {
      status: status || undefined,
      lead_id: lead_id || undefined,
      limit: parseInt(limit, 10),
      offset: parseInt(offset, 10),
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// Get templates
router.get('/templates', async (req, res, next) => {
  try {
    const templates = await estimateService.getTemplates(req.tenantId);
    res.json({ templates });
  } catch (err) {
    next(err);
  }
});

// Create template
router.post('/templates', async (req, res, next) => {
  try {
    const { name, description, unit, default_unit_price, section } = req.body;
    if (!name) return res.status(400).json({ error: 'Name is required' });
    const { rows } = await pool.query(
      `INSERT INTO estimate_templates (tenant_id, name, description, unit, default_unit_price, section, position)
       VALUES ($1, $2, $3, $4, $5, $6, (SELECT COALESCE(MAX(position), -1) + 1 FROM estimate_templates WHERE tenant_id = $1))
       RETURNING *`,
      [req.tenantId, name, description || '', unit || 'each', Number(default_unit_price) || 0, section || 'Roof']
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    next(err);
  }
});

// Update template
router.patch('/templates/:id', validateId(), async (req, res, next) => {
  try {
    const { name, description, unit, default_unit_price, section } = req.body;
    const fields = [];
    const vals = [];
    let idx = 1;
    if (name !== undefined) { fields.push(`name = $${idx++}`); vals.push(name); }
    if (description !== undefined) { fields.push(`description = $${idx++}`); vals.push(description); }
    if (unit !== undefined) { fields.push(`unit = $${idx++}`); vals.push(unit); }
    if (default_unit_price !== undefined) { fields.push(`default_unit_price = $${idx++}`); vals.push(Number(default_unit_price)); }
    if (section !== undefined) { fields.push(`section = $${idx++}`); vals.push(section); }
    if (fields.length === 0) return res.status(400).json({ error: 'No fields to update' });
    vals.push(req.params.id, req.tenantId);
    const { rows } = await pool.query(
      `UPDATE estimate_templates SET ${fields.join(', ')} WHERE id = $${idx++} AND tenant_id = $${idx} RETURNING *`,
      vals
    );
    if (!rows.length) return res.status(404).json({ error: 'Template not found' });
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
});

// Delete template
router.delete('/templates/:id', validateId(), async (req, res, next) => {
  try {
    const { rowCount } = await pool.query(
      'DELETE FROM estimate_templates WHERE id = $1 AND tenant_id = $2',
      [req.params.id, req.tenantId]
    );
    if (!rowCount) return res.status(404).json({ error: 'Template not found' });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// Get single estimate
router.get('/:id', validateId(), async (req, res, next) => {
  try {
    const estimate = await estimateService.getEstimateDetail(req.tenantId, req.params.id);
    if (!estimate) return res.status(404).json({ error: 'Estimate not found' });
    res.json(estimate);
  } catch (err) {
    next(err);
  }
});

// Create estimate
router.post('/', async (req, res, next) => {
  try {
    if (!req.body.lead_id) {
      return res.status(400).json({ error: 'lead_id is required' });
    }
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!UUID_RE.test(req.body.lead_id)) return res.status(400).json({ error: 'Invalid lead_id format' });
    const estimate = await estimateService.createEstimate(req.tenantId, req.user.id, req.body);
    res.status(201).json(estimate);
  } catch (err) {
    next(err);
  }
});

// Update estimate
router.patch('/:id', validateId(), async (req, res, next) => {
  try {
    const estimate = await estimateService.updateEstimate(req.tenantId, req.params.id, req.body);
    if (!estimate) return res.status(404).json({ error: 'Estimate not found' });
    res.json(estimate);
  } catch (err) {
    next(err);
  }
});

// Delete estimate
router.delete('/:id', validateId(), async (req, res, next) => {
  try {
    const deleted = await estimateService.deleteEstimate(req.tenantId, req.params.id);
    if (!deleted) return res.status(404).json({ error: 'Estimate not found' });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// Send estimate to customer
router.post('/:id/send', validateId(), async (req, res, next) => {
  try {
    const estimate = await estimateService.sendEstimate(req.tenantId, req.params.id);
    if (!estimate) return res.status(404).json({ error: 'Estimate not found or already sent' });
    res.json(estimate);
  } catch (err) {
    next(err);
  }
});

// Duplicate estimate
router.post('/:id/duplicate', validateId(), async (req, res, next) => {
  try {
    const estimate = await estimateService.duplicateEstimate(req.tenantId, req.user.id, req.params.id);
    if (!estimate) return res.status(404).json({ error: 'Estimate not found' });
    res.status(201).json(estimate);
  } catch (err) {
    next(err);
  }
});

// Generate branded PDF for an estimate
router.get('/:id/pdf', validateId(), async (req, res, next) => {
  try {
    const estimate = await estimateService.getEstimateDetail(req.tenantId, req.params.id);
    if (!estimate) return res.status(404).json({ error: 'Estimate not found' });

    const { createRequire } = await import('module');
    const require = createRequire(import.meta.url);
    const PdfPrinter = require('pdfmake');
    const fonts = {
      Helvetica: {
        normal: 'Helvetica',
        bold: 'Helvetica-Bold',
        italics: 'Helvetica-Oblique',
        bolditalics: 'Helvetica-BoldOblique',
      },
    };
    const printer = new PdfPrinter(fonts);

    const companyName = estimate.company_name || 'StormLeads';
    const lineItems = Array.isArray(estimate.line_items) ? estimate.line_items : [];
    const fmtCurrency = (v) => `$${Number(v || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : '';

    // Group line items by section
    const sections = {};
    for (const item of lineItems) {
      const sec = item.section || 'General';
      if (!sections[sec]) sections[sec] = [];
      sections[sec].push(item);
    }

    // Build line item tables per section
    const lineItemContent = [];
    for (const [sectionName, items] of Object.entries(sections)) {
      lineItemContent.push({ text: sectionName, style: 'sectionHeader', marginTop: 10 });
      const tableBody = [
        [
          { text: 'Description', style: 'tableHeader' },
          { text: 'Qty', style: 'tableHeader', alignment: 'center' },
          { text: 'Unit Price', style: 'tableHeader', alignment: 'right' },
          { text: 'Total', style: 'tableHeader', alignment: 'right' },
        ],
      ];
      for (const item of items) {
        const qty = Number(item.quantity) || 1;
        const price = Number(item.unit_price) || 0;
        tableBody.push([
          { text: item.description || '', fontSize: 9 },
          { text: String(qty), alignment: 'center', fontSize: 9 },
          { text: fmtCurrency(price), alignment: 'right', fontSize: 9 },
          { text: fmtCurrency(qty * price), alignment: 'right', fontSize: 9 },
        ]);
        if (item.details) {
          tableBody.push([{ text: item.details, colSpan: 4, fontSize: 8, color: '#666', italics: true }, '', '', '']);
        }
      }
      lineItemContent.push({
        table: { headerRows: 1, widths: ['*', 50, 80, 80], body: tableBody },
        layout: 'lightHorizontalLines',
      });
    }

    // Totals
    const totalsBody = [
      [{ text: 'Subtotal', alignment: 'right', bold: true }, { text: fmtCurrency(estimate.subtotal), alignment: 'right' }],
    ];
    if (Number(estimate.discount_value) > 0) {
      const discLabel = estimate.discount_type === 'percent' ? `Discount (${estimate.discount_value}%)` : 'Discount';
      const discAmount = estimate.discount_type === 'percent'
        ? Number(estimate.subtotal) * Number(estimate.discount_value) / 100
        : Number(estimate.discount_value);
      totalsBody.push([{ text: discLabel, alignment: 'right' }, { text: `-${fmtCurrency(discAmount)}`, alignment: 'right', color: '#c00' }]);
    }
    if (Number(estimate.tax_amount) > 0) {
      totalsBody.push([{ text: `Tax (${estimate.tax_rate}%)`, alignment: 'right' }, { text: fmtCurrency(estimate.tax_amount), alignment: 'right' }]);
    }
    totalsBody.push([{ text: 'Total', alignment: 'right', bold: true, fontSize: 13 }, { text: fmtCurrency(estimate.total), alignment: 'right', bold: true, fontSize: 13 }]);

    // Build document
    const content = [
      // Cover / header
      { text: companyName, style: 'companyName' },
      { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 2, lineColor: '#2563eb' }], marginBottom: 10 },
      { text: 'ESTIMATE', style: 'title' },
      {
        columns: [
          {
            width: '*',
            stack: [
              { text: 'Prepared for:', style: 'label' },
              { text: estimate.customer_name || estimate.lead_name || '—', bold: true, fontSize: 11 },
              { text: estimate.customer_address || estimate.lead_address || '', fontSize: 9, color: '#555' },
              { text: [estimate.customer_phone || estimate.lead_phone || '', estimate.customer_email || estimate.lead_email || ''].filter(Boolean).join(' | '), fontSize: 9, color: '#555' },
            ],
          },
          {
            width: 180,
            stack: [
              { text: `Estimate #: ${estimate.estimate_number}`, fontSize: 9 },
              { text: `Date: ${fmtDate(estimate.created_at)}`, fontSize: 9 },
              estimate.valid_until ? { text: `Valid Until: ${fmtDate(estimate.valid_until)}`, fontSize: 9 } : null,
              { text: `Status: ${(estimate.status || 'draft').toUpperCase()}`, fontSize: 9, bold: true },
              { text: `Prepared by: ${[estimate.creator_first_name, estimate.creator_last_name].filter(Boolean).join(' ')}`, fontSize: 9 },
            ].filter(Boolean),
          },
        ],
        marginTop: 10,
        marginBottom: 15,
      },
    ];

    // Scope of work (with token replacement)
    if (estimate.scope_of_work) {
      content.push({ text: 'Scope of Work', style: 'sectionHeader' });
      content.push({ text: estimateService.replaceTokens(estimate.scope_of_work, estimate), fontSize: 9, marginBottom: 10 });
    }

    // Line items
    content.push(...lineItemContent);

    // Totals table
    content.push({
      marginTop: 15,
      table: { widths: ['*', 100], body: totalsBody },
      layout: 'noBorders',
    });

    // Terms & warranty
    if (estimate.terms) {
      content.push({ text: 'Terms & Conditions', style: 'sectionHeader', marginTop: 20 });
      content.push({ text: estimateService.replaceTokens(estimate.terms, estimate), fontSize: 8, color: '#555' });
    }
    if (estimate.warranty_info) {
      content.push({ text: 'Warranty Information', style: 'sectionHeader', marginTop: 10 });
      content.push({ text: estimateService.replaceTokens(estimate.warranty_info, estimate), fontSize: 8, color: '#555' });
    }

    // Signature block
    if (estimate.signed_at) {
      content.push({ text: 'Signature', style: 'sectionHeader', marginTop: 20 });
      content.push({ text: `Signed by ${estimate.signer_name} on ${fmtDate(estimate.signed_at)}`, fontSize: 9 });
    } else {
      content.push({
        marginTop: 30,
        columns: [
          { width: '*', stack: [
            { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 200, y2: 0, lineWidth: 0.5 }] },
            { text: 'Customer Signature', fontSize: 8, color: '#999', marginTop: 2 },
          ]},
          { width: '*', stack: [
            { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 200, y2: 0, lineWidth: 0.5 }] },
            { text: 'Date', fontSize: 8, color: '#999', marginTop: 2 },
          ]},
        ],
      });
    }

    // Footer
    content.push({ text: `Generated by ${companyName} via StormLeads`, style: 'footer', marginTop: 30 });

    const docDefinition = {
      defaultStyle: { font: 'Helvetica', fontSize: 10 },
      pageMargins: [40, 40, 40, 40],
      content,
      styles: {
        companyName: { fontSize: 22, bold: true, color: '#1e293b' },
        title: { fontSize: 16, bold: true, color: '#2563eb', marginBottom: 10 },
        label: { fontSize: 8, color: '#888', marginBottom: 2 },
        sectionHeader: { fontSize: 12, bold: true, color: '#1e293b', marginBottom: 4, marginTop: 8 },
        tableHeader: { bold: true, fontSize: 9, fillColor: '#f1f5f9', color: '#334155' },
        footer: { fontSize: 7, color: '#aaa', alignment: 'center' },
      },
    };

    const pdfDoc = printer.createPdfKitDocument(docDefinition);
    const chunks = [];
    pdfDoc.on('data', chunk => chunks.push(chunk));
    pdfDoc.on('end', () => {
      const pdfBuffer = Buffer.concat(chunks);
      const safeName = (estimate.estimate_number || 'estimate').replace(/[^a-zA-Z0-9-]/g, '_');
      res.set({
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${safeName}.pdf"`,
        'Content-Length': pdfBuffer.length,
      });
      res.send(pdfBuffer);
    });
    pdfDoc.end();
  } catch (err) {
    next(err);
  }
});

// In-person signing (SumoQuote on-the-spot pattern)
router.post('/:id/sign-in-person', validateId(), async (req, res, next) => {
  try {
    const { signer_name, signature_data } = req.body;
    if (!signer_name) return res.status(400).json({ error: 'signer_name required' });
    const estimate = await estimateService.signEstimateInPerson(
      req.tenantId, req.params.id, signer_name, signature_data || null
    );
    if (!estimate) return res.status(404).json({ error: 'Estimate not found or already resolved' });
    res.json(estimate);
  } catch (err) {
    next(err);
  }
});

// Generate Good/Better/Best tiers from a single estimate
router.post('/:id/generate-tiers', validateId(), async (req, res, next) => {
  try {
    const tiers = await estimateService.generateTiers(req.tenantId, req.user.id, req.params.id);
    if (!tiers) return res.status(404).json({ error: 'Estimate not found' });
    res.status(201).json({ tiers });
  } catch (err) {
    next(err);
  }
});

export default router;
