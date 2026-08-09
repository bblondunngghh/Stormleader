import { Router } from 'express';
import authenticate from '../middleware/authenticate.js';
import tenantScope from '../middleware/tenantScope.js';
import validateId from '../middleware/validateId.js';
import * as contractService from '../services/contractService.js';
import { parsePagination } from '../utils/pagination.js';

const router = Router();

// ============================================================
// PUBLIC routes (no auth — customer-facing)
// ============================================================

router.get('/public/:token', async (req, res, next) => {
  try {
    const contract = await contractService.getContractByToken(req.params.token);
    if (!contract) return res.status(404).json({ error: 'Contract not found' });
    // Mark as viewed (side effect) and return updated state
    await contractService.markViewed(req.params.token);
    const updated = await contractService.getContractByToken(req.params.token);
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

router.post('/public/:token/sign', async (req, res, next) => {
  try {
    const { signerName, signatureData } = req.body;
    if (!signerName) return res.status(400).json({ error: 'signerName is required' });
    const contract = await contractService.signContract(req.params.token, { signerName, signatureData });
    if (!contract) return res.status(404).json({ error: 'Contract not found or already signed' });
    res.json(contract);
  } catch (err) {
    next(err);
  }
});

// ============================================================
// AUTHENTICATED routes
// ============================================================

router.use(authenticate);
router.use(tenantScope);

// ── Template routes (BEFORE /:id to avoid "templates" matching as id) ──

router.get('/templates', async (req, res, next) => {
  try {
    const templates = await contractService.listTemplates(req.tenantId);
    res.json({ templates });
  } catch (err) {
    next(err);
  }
});

router.post('/templates', async (req, res, next) => {
  try {
    const { name, type, content } = req.body;
    if (!name || !type) return res.status(400).json({ error: 'name and type are required' });
    const template = await contractService.createTemplate(req.tenantId, { name, type, content });
    res.status(201).json(template);
  } catch (err) {
    next(err);
  }
});

router.patch('/templates/:id', validateId(), async (req, res, next) => {
  try {
    const template = await contractService.updateTemplate(req.tenantId, req.params.id, req.body);
    if (!template) return res.status(404).json({ error: 'Template not found or not editable' });
    res.json(template);
  } catch (err) {
    next(err);
  }
});

router.delete('/templates/:id', validateId(), async (req, res, next) => {
  try {
    const deleted = await contractService.deleteTemplate(req.tenantId, req.params.id);
    if (!deleted) return res.status(404).json({ error: 'Template not found or cannot be deleted' });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// ── Contract CRUD ──

router.get('/', async (req, res, next) => {
  try {
    const { status, lead_id } = req.query;
    const { limit, offset } = parsePagination(req.query);
    const result = await contractService.listContracts(req.tenantId, {
      status: status || undefined,
      leadId: lead_id || undefined,
      limit,
      offset,
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.get('/:id', validateId(), async (req, res, next) => {
  try {
    const contract = await contractService.getContract(req.tenantId, req.params.id);
    if (!contract) return res.status(404).json({ error: 'Contract not found' });
    res.json(contract);
  } catch (err) {
    next(err);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const { leadId, estimateId, templateType, content } = req.body;
    if (!leadId) {
      return res.status(400).json({ error: 'lead_id is required' });
    }
    const contract = await contractService.createContract(req.tenantId, { leadId, estimateId, templateType, content });
    res.status(201).json(contract);
  } catch (err) {
    next(err);
  }
});

router.patch('/:id', validateId(), async (req, res, next) => {
  try {
    if (!req.body || Object.keys(req.body).length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }
    const contract = await contractService.updateContract(req.tenantId, req.params.id, req.body);
    if (!contract) return res.status(404).json({ error: 'Contract not found or not in draft status' });
    res.json(contract);
  } catch (err) {
    next(err);
  }
});

router.post('/:id/send', validateId(), async (req, res, next) => {
  try {
    const contract = await contractService.sendContract(req.tenantId, req.params.id);
    if (!contract) return res.status(404).json({ error: 'Contract not found or not in draft status' });
    res.json(contract);
  } catch (err) {
    next(err);
  }
});

router.post('/:id/void', validateId(), async (req, res, next) => {
  try {
    const contract = await contractService.voidContract(req.tenantId, req.params.id);
    if (!contract) return res.status(404).json({ error: 'Contract not found' });
    res.json(contract);
  } catch (err) {
    next(err);
  }
});

// Generate branded PDF for a contract (mirrors estimate PDF generation)
router.get('/:id/pdf', validateId(), async (req, res, next) => {
  try {
    const contract = await contractService.getContract(req.tenantId, req.params.id);
    if (!contract) return res.status(404).json({ error: 'Contract not found' });

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

    const companyName = contract.company_name || 'StormLeads';
    const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : '';

    // Parse contract sections. content is JSONB, so it stores whatever shape was written
    // and node-postgres hands back the parsed value (object, array, string or number).
    // A bare JSON.parse threw on a stored string that is not itself JSON.
    let rawContent = contract.content;
    if (typeof rawContent === 'string') {
      try { rawContent = JSON.parse(rawContent); } catch { /* plain text, not JSON */ }
    }
    const bodyFromPlainText = typeof rawContent === 'string' ? rawContent : '';
    if (!rawContent || typeof rawContent !== 'object') rawContent = {};

    // Array.isArray guards the CONTAINER, the filter guards the ELEMENTS. A truthy
    // non-array (42, {...}) is not iterable, and [null] has length 1 so it survived the
    // old `|| []` and then threw on section.title. Same defect and same fix as the
    // estimate PDF (estimates.js) and the work-order PDF (workOrders.js).
    const parsedSections = (Array.isArray(rawContent.sections) ? rawContent.sections : [])
      .filter((s) => s && typeof s === 'object');
    const sections = parsedSections.length
      ? parsedSections
      : [{ title: 'Agreement', body: bodyFromPlainText }];

    // Build document content
    const content = [
      { text: companyName, style: 'companyName' },
      { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 2, lineColor: '#2563eb' }], marginBottom: 10 },
      { text: 'CONTRACT', style: 'title' },
      {
        columns: [
          {
            width: '*',
            stack: [
              { text: 'Prepared for:', style: 'label' },
              { text: contract.contact_name || '—', bold: true, fontSize: 11 },
              { text: contract.address || '', fontSize: 9, color: '#555' },
              { text: [contract.contact_phone || '', contract.contact_email || ''].filter(Boolean).join(' | '), fontSize: 9, color: '#555' },
            ],
          },
          {
            width: 180,
            stack: [
              { text: `Contract #: ${contract.contract_number || contract.id}`, fontSize: 9 },
              { text: `Date: ${fmtDate(contract.created_at)}`, fontSize: 9 },
              { text: `Status: ${(contract.status || 'draft').toUpperCase()}`, fontSize: 9, bold: true },
              contract.estimate_number ? { text: `Estimate: ${contract.estimate_number}`, fontSize: 9 } : null,
            ].filter(Boolean),
          },
        ],
        marginTop: 10,
        marginBottom: 20,
      },
    ];

    // Render each contract section
    for (const section of sections) {
      if (section.title) {
        content.push({ text: String(section.title), style: 'sectionHeader' });
      }
      if (section.body) {
        // Strip HTML tags for plain text PDF (basic conversion).
        // String() because body is JSONB-sourced and may be a number/object/array,
        // on which .replace is not a function.
        const plainText = String(section.body)
          .replace(/<br\s*\/?>/gi, '\n')
          .replace(/<\/p>/gi, '\n')
          .replace(/<[^>]+>/g, '')
          .replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&quot;/g, '"')
          .replace(/&#39;/g, "'")
          .replace(/\n{3,}/g, '\n\n')
          .trim();
        content.push({ text: plainText, fontSize: 10, marginBottom: 12, lineHeight: 1.5 });
      }
    }

    // Signature block
    if (contract.signed_at && contract.signer_name) {
      content.push({ text: 'Signatures', style: 'sectionHeader', marginTop: 20 });
      content.push({ text: `Signed by ${contract.signer_name} on ${fmtDate(contract.signed_at)}`, fontSize: 9, marginBottom: 10 });
      if (contract.signature_data) {
        try {
          const imgData = contract.signature_data.replace(/^data:image\/\w+;base64,/, '');
          content.push({ image: `data:image/png;base64,${imgData}`, width: 180, marginBottom: 10 });
        } catch { /* skip if invalid */ }
      }
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
      content.push({
        marginTop: 20,
        columns: [
          { width: '*', stack: [
            { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 200, y2: 0, lineWidth: 0.5 }] },
            { text: 'Company Representative', fontSize: 8, color: '#999', marginTop: 2 },
          ]},
          { width: '*', stack: [
            { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 200, y2: 0, lineWidth: 0.5 }] },
            { text: 'Date', fontSize: 8, color: '#999', marginTop: 2 },
          ]},
        ],
      });
    }

    content.push({ text: `Generated by ${companyName} via StormLeads`, style: 'footer', marginTop: 30 });

    const docDefinition = {
      defaultStyle: { font: 'Helvetica', fontSize: 10 },
      pageMargins: [40, 40, 40, 40],
      content,
      styles: {
        companyName: { fontSize: 22, bold: true, color: '#1e293b' },
        title: { fontSize: 16, bold: true, color: '#2563eb', marginBottom: 10 },
        label: { fontSize: 8, color: '#888', marginBottom: 2 },
        sectionHeader: { fontSize: 12, bold: true, color: '#1e293b', marginBottom: 6, marginTop: 14 },
        footer: { fontSize: 7, color: '#aaa', alignment: 'center' },
      },
    };

    const pdfDoc = printer.createPdfKitDocument(docDefinition);
    const chunks = [];
    pdfDoc.on('data', chunk => chunks.push(chunk));
    pdfDoc.on('end', () => {
      const pdfBuffer = Buffer.concat(chunks);
      const safeName = (contract.contract_number || `contract-${contract.id}`).replace(/[^a-zA-Z0-9-]/g, '_');
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

export default router;
