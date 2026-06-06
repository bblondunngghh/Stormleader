import { Router } from 'express';
import authenticate from '../middleware/authenticate.js';
import tenantScope from '../middleware/tenantScope.js';
import validateId from '../middleware/validateId.js';
import * as workOrderService from '../services/workOrderService.js';
import pool from '../db/pool.js';
import { parsePagination } from '../utils/pagination.js';

const router = Router();
router.use(authenticate);
router.use(tenantScope);

// List available milestone templates
router.get('/milestone-templates', (req, res) => {
  const templates = Object.entries(workOrderService.MILESTONE_TEMPLATES).map(([key, val]) => ({
    key,
    label: val.label,
    milestones: val.milestones.map(ms => typeof ms === 'string' ? ms : ms.name),
    photo_required: val.milestones.map(ms => typeof ms === 'string' ? false : !!ms.photo_required),
    count: val.milestones.length,
  }));
  res.json({ templates });
});

// List work orders
router.get('/', async (req, res, next) => {
  try {
    const { status, assigned_to } = req.query;
    const { limit, offset } = parsePagination(req.query);
    const result = await workOrderService.getWorkOrders(req.tenantId, {
      status: status || undefined,
      assignedTo: assigned_to || undefined,
      limit,
      offset,
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// Get single work order
router.get('/:id', validateId(), async (req, res, next) => {
  try {
    const wo = await workOrderService.getWorkOrder(req.tenantId, req.params.id);
    if (!wo) return res.status(404).json({ error: 'Work order not found' });
    res.json(wo);
  } catch (err) {
    next(err);
  }
});

// Create work order
router.post('/', async (req, res, next) => {
  try {
    if (!req.body.title) {
      return res.status(400).json({ error: 'title is required' });
    }
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const { lead_id, estimate_id, status } = req.body;
    if (lead_id && !UUID_RE.test(lead_id)) return res.status(400).json({ error: 'Invalid lead_id format' });
    if (estimate_id && !UUID_RE.test(estimate_id)) return res.status(400).json({ error: 'Invalid estimate_id format' });
    if (status) {
      const validStatuses = ['pending', 'scheduled', 'in_progress', 'completed', 'cancelled'];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({ error: `status must be one of: ${validStatuses.join(', ')}` });
      }
    }
    const wo = await workOrderService.createWorkOrder(req.tenantId, req.body);
    res.status(201).json(wo);
  } catch (err) {
    next(err);
  }
});

// Create from estimate
router.post('/from-estimate/:estimateId', validateId('estimateId'), async (req, res, next) => {
  try {
    const wo = await workOrderService.createFromEstimate(req.tenantId, req.params.estimateId);
    if (!wo) return res.status(404).json({ error: 'Estimate not found' });
    res.status(201).json(wo);
  } catch (err) {
    next(err);
  }
});

// Update work order
router.patch('/:id', validateId(), async (req, res, next) => {
  try {
    if (req.body.status) {
      const validStatuses = ['pending', 'scheduled', 'in_progress', 'completed', 'cancelled'];
      if (!validStatuses.includes(req.body.status)) {
        return res.status(400).json({ error: `status must be one of: ${validStatuses.join(', ')}` });
      }
    }
    const wo = await workOrderService.updateWorkOrder(req.tenantId, req.params.id, req.body);
    if (!wo) return res.status(404).json({ error: 'Work order not found' });
    res.json(wo);
  } catch (err) {
    next(err);
  }
});

// Mark complete
router.patch('/:id/complete', validateId(), async (req, res, next) => {
  try {
    const wo = await workOrderService.completeWorkOrder(req.tenantId, req.params.id);
    if (!wo) return res.status(404).json({ error: 'Work order not found' });
    res.json(wo);
  } catch (err) {
    next(err);
  }
});

// Get milestones for a work order (tenant-scoped)
router.get('/:id/milestones', validateId(), async (req, res, next) => {
  try {
    // Verify work order belongs to this tenant before returning milestones
    const wo = await workOrderService.getWorkOrder(req.tenantId, req.params.id);
    if (!wo) return res.status(404).json({ error: 'Work order not found' });
    const milestones = await workOrderService.getMilestones(req.params.id);
    res.json({ milestones });
  } catch (err) {
    next(err);
  }
});

// Create a new milestone — tenant-scoped
router.post('/:id/milestones', validateId(), async (req, res, next) => {
  try {
    const { name } = req.body;
    if (typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ error: 'Milestone name required' });
    }
    const wo = await workOrderService.getWorkOrder(req.tenantId, req.params.id);
    if (!wo) return res.status(404).json({ error: 'Work order not found' });
    const { rows: [maxOrder] } = await pool.query(
      'SELECT COALESCE(MAX(sort_order), 0) + 1 AS next_order FROM work_order_milestones WHERE work_order_id = $1',
      [req.params.id]
    );
    const { rows: [milestone] } = await pool.query(
      `INSERT INTO work_order_milestones (work_order_id, name, sort_order) VALUES ($1, $2, $3) RETURNING *`,
      [req.params.id, name.trim(), maxOrder.next_order]
    );
    res.status(201).json(milestone);
  } catch (err) { next(err); }
});

// Delete a milestone — tenant-scoped
router.delete('/:woId/milestones/:milestoneId', validateId('woId', 'milestoneId'), async (req, res, next) => {
  try {
    const wo = await workOrderService.getWorkOrder(req.tenantId, req.params.woId);
    if (!wo) return res.status(404).json({ error: 'Work order not found' });
    await pool.query(
      'DELETE FROM work_order_milestones WHERE id = $1 AND work_order_id = $2',
      [req.params.milestoneId, req.params.woId]
    );
    res.json({ success: true });
  } catch (err) { next(err); }
});

// Update a milestone (toggle complete, set photo) — tenant-scoped
router.patch('/:id/milestones/:milestoneId', validateId('id', 'milestoneId'), async (req, res, next) => {
  try {
    // Verify work order belongs to this tenant
    const wo = await workOrderService.getWorkOrder(req.tenantId, req.params.id);
    if (!wo) return res.status(404).json({ error: 'Work order not found' });
    const { completed, photo_url } = req.body;
    const milestone = await workOrderService.updateMilestone(
      req.params.id, req.params.milestoneId,
      { completed, photoUrl: photo_url }
    );
    if (!milestone) return res.status(404).json({ error: 'Milestone not found' });

    // Check if all milestones complete → auto-complete work order
    if (completed) {
      await workOrderService.checkAndCompleteWorkOrder(req.params.id);
    }

    res.json(milestone);
  } catch (err) {
    if (err.status === 422) return res.status(422).json({ error: err.message });
    next(err);
  }
});

// GET /:id/pdf — Generate work order PDF with milestones and photos (vs RoofLink)
router.get('/:id/pdf', validateId(), async (req, res, next) => {
  try {
    const wo = await workOrderService.getWorkOrder(req.tenantId, req.params.id);
    if (!wo) return res.status(404).json({ error: 'Work order not found' });

    const milestones = await workOrderService.getMilestones(wo.id);

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

    const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : '—';
    const fmtTime = (t) => {
      if (!t) return '';
      const [h, m] = t.split(':');
      const hr = parseInt(h, 10);
      return `${hr % 12 || 12}:${m} ${hr >= 12 ? 'PM' : 'AM'}`;
    };
    const fmtCurrency = (v) => `$${Number(v || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    const statusLabel = { pending: 'Pending', scheduled: 'Scheduled', in_progress: 'In Progress', completed: 'Completed' };
    const lineItems = Array.isArray(wo.line_items) ? wo.line_items : [];

    // Build milestone checklist
    const milestoneRows = milestones.map(m => ([
      { text: m.completed ? '☑' : '☐', fontSize: 14, alignment: 'center' },
      { text: m.name, fontSize: 10 },
      { text: m.completed_at ? fmtDate(m.completed_at) : '—', fontSize: 9, color: '#666' },
      { text: m.photo_required ? 'Yes' : 'No', fontSize: 9, alignment: 'center' },
    ]));

    // Build line items table
    const lineItemBody = lineItems.length > 0 ? [
      [
        { text: 'Description', style: 'tableHeader' },
        { text: 'Qty', style: 'tableHeader', alignment: 'center' },
        { text: 'Unit Price', style: 'tableHeader', alignment: 'right' },
        { text: 'Total', style: 'tableHeader', alignment: 'right' },
      ],
      ...lineItems.map(item => ([
        { text: item.description || '', fontSize: 9 },
        { text: String(item.quantity || 1), alignment: 'center', fontSize: 9 },
        { text: fmtCurrency(item.unit_price), alignment: 'right', fontSize: 9 },
        { text: fmtCurrency((item.quantity || 1) * (item.unit_price || 0)), alignment: 'right', fontSize: 9 },
      ])),
    ] : null;

    const totalCost = lineItems.reduce((sum, it) => sum + ((it.quantity || 1) * (it.unit_price || 0)), 0);
    const completedCount = milestones.filter(m => m.completed).length;

    const content = [
      { text: 'WORK ORDER', style: 'title' },
      { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 1, lineColor: '#2563EB' }], marginBottom: 10 },
      {
        columns: [
          { width: '50%', stack: [
            { text: wo.title || 'Untitled', fontSize: 16, bold: true, marginBottom: 4 },
            wo.address ? { text: wo.address, fontSize: 10, color: '#444' } : null,
            wo.crew_name ? { text: `Crew: ${wo.crew_name}`, fontSize: 10, color: '#444', marginTop: 2 } : null,
          ].filter(Boolean) },
          { width: '50%', alignment: 'right', stack: [
            { text: `Status: ${statusLabel[wo.status] || wo.status}`, fontSize: 10, bold: true },
            { text: `Date: ${wo.scheduled_date ? fmtDate(wo.scheduled_date) : '—'}`, fontSize: 10 },
            wo.scheduled_time_start ? { text: `Time: ${fmtTime(wo.scheduled_time_start)}${wo.scheduled_time_end ? ' – ' + fmtTime(wo.scheduled_time_end) : ''}`, fontSize: 10 } : null,
            totalCost > 0 ? { text: `Total: ${fmtCurrency(totalCost)}`, fontSize: 12, bold: true, marginTop: 4 } : null,
          ].filter(Boolean) },
        ],
        marginBottom: 16,
      },
    ];

    if (wo.description) {
      content.push({ text: 'Description', style: 'sectionHeader' });
      content.push({ text: wo.description, fontSize: 10, marginBottom: 12 });
    }

    // Milestones checklist
    if (milestoneRows.length > 0) {
      content.push({ text: `Milestones (${completedCount}/${milestones.length})`, style: 'sectionHeader' });
      content.push({
        table: {
          headerRows: 1,
          widths: [24, '*', 80, 50],
          body: [
            [
              { text: '✓', style: 'tableHeader', alignment: 'center' },
              { text: 'Milestone', style: 'tableHeader' },
              { text: 'Completed', style: 'tableHeader' },
              { text: 'Photo', style: 'tableHeader', alignment: 'center' },
            ],
            ...milestoneRows,
          ],
        },
        layout: 'lightHorizontalLines',
        marginBottom: 12,
      });
    }

    // Line items
    if (lineItemBody) {
      content.push({ text: 'Line Items', style: 'sectionHeader' });
      content.push({
        table: { headerRows: 1, widths: ['*', 50, 80, 80], body: lineItemBody },
        layout: 'lightHorizontalLines',
        marginBottom: 4,
      });
      content.push({ text: `Total: ${fmtCurrency(totalCost)}`, fontSize: 12, bold: true, alignment: 'right', marginBottom: 12 });
    }

    if (wo.notes) {
      content.push({ text: 'Notes', style: 'sectionHeader' });
      content.push({ text: wo.notes, fontSize: 10 });
    }

    const docDefinition = {
      pageSize: 'LETTER',
      pageMargins: [40, 40, 40, 40],
      defaultStyle: { font: 'Helvetica' },
      content,
      styles: {
        title: { fontSize: 22, bold: true, color: '#1e3a5f', marginBottom: 4 },
        sectionHeader: { fontSize: 12, bold: true, color: '#1e3a5f', marginTop: 10, marginBottom: 6 },
        tableHeader: { fontSize: 9, bold: true, color: '#333', fillColor: '#f0f4f8' },
      },
      footer: (currentPage, pageCount) => ({
        columns: [
          { text: `Generated ${new Date().toLocaleDateString()}`, fontSize: 8, color: '#999', margin: [40, 0, 0, 0] },
          { text: `Page ${currentPage} of ${pageCount}`, fontSize: 8, color: '#999', alignment: 'right', margin: [0, 0, 40, 0] },
        ],
      }),
    };

    const pdfDoc = printer.createPdfKitDocument(docDefinition);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="work-order-${wo.id.slice(0, 8)}.pdf"`);
    pdfDoc.pipe(res);
    pdfDoc.end();
  } catch (err) {
    next(err);
  }
});

export default router;
