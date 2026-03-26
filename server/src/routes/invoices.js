import { Router } from 'express';
import authenticate from '../middleware/authenticate.js';
import tenantScope from '../middleware/tenantScope.js';
import * as invoiceService from '../services/invoiceService.js';
import pool from '../db/pool.js';

const router = Router();
router.use(authenticate);
router.use(tenantScope);

// List invoices
router.get('/', async (req, res, next) => {
  try {
    const { status, limit = '50', offset = '0' } = req.query;
    const result = await invoiceService.getInvoices(req.tenantId, {
      status: status || undefined,
      limit: parseInt(limit, 10),
      offset: parseInt(offset, 10),
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// Get single invoice
router.get('/:id', async (req, res, next) => {
  try {
    const invoice = await invoiceService.getInvoice(req.tenantId, req.params.id);
    if (!invoice) return res.status(404).json({ error: 'Invoice not found' });
    res.json(invoice);
  } catch (err) {
    next(err);
  }
});

// Create invoice
router.post('/', async (req, res, next) => {
  try {
    const invoice = await invoiceService.createInvoice(req.tenantId, req.body);
    res.status(201).json(invoice);
  } catch (err) {
    next(err);
  }
});

// Create from estimate
router.post('/from-estimate/:estimateId', async (req, res, next) => {
  try {
    const invoice = await invoiceService.createFromEstimate(req.tenantId, req.params.estimateId);
    if (!invoice) return res.status(404).json({ error: 'Estimate not found' });
    res.status(201).json(invoice);
  } catch (err) {
    next(err);
  }
});

// Update invoice
router.patch('/:id', async (req, res, next) => {
  try {
    const invoice = await invoiceService.updateInvoice(req.tenantId, req.params.id, req.body);
    if (!invoice) return res.status(404).json({ error: 'Invoice not found' });
    res.json(invoice);
  } catch (err) {
    next(err);
  }
});

// Record payment
router.post('/:id/payment', async (req, res, next) => {
  try {
    const { amount } = req.body;
    if (!amount || amount <= 0) return res.status(400).json({ error: 'Valid amount required' });
    const invoice = await invoiceService.recordPayment(req.tenantId, req.params.id, amount);
    if (!invoice) return res.status(404).json({ error: 'Invoice not found' });
    res.json(invoice);
  } catch (err) {
    next(err);
  }
});

// Mark as sent
router.post('/:id/send', async (req, res, next) => {
  try {
    const invoice = await invoiceService.sendInvoice(req.tenantId, req.params.id);
    if (!invoice) return res.status(404).json({ error: 'Invoice not found' });
    res.json(invoice);
  } catch (err) {
    next(err);
  }
});

// Send invoice via email
router.post('/:id/send-email', async (req, res, next) => {
  try {
    const { to } = req.body;
    if (!to) return res.status(400).json({ error: 'Recipient email required' });

    // Get invoice + tenant info
    const { rows: [inv] } = await pool.query(
      `SELECT i.*, t.name AS company_name, t.sender_email, t.branding, t.company_phone
       FROM invoices i JOIN tenants t ON t.id = i.tenant_id
       WHERE i.id = $1 AND i.tenant_id = $2`,
      [req.params.id, req.tenantId]
    );
    if (!inv) return res.status(404).json({ error: 'Invoice not found' });

    const branding = inv.branding || {};
    const { getTenantTransporter } = await import('../services/emailService.js');
    const transporter = getTenantTransporter(branding);
    if (!transporter) return res.status(400).json({ error: 'Email not configured. Set up SMTP in Settings first.' });

    const from = branding.smtp_from || inv.sender_email || '"StormLeads" <noreply@stormleads.io>';
    const total = Number(inv.total || 0).toLocaleString('en-US', { style: 'currency', currency: 'USD' });
    const dueDate = inv.due_date ? new Date(inv.due_date).toLocaleDateString() : 'Upon receipt';
    const companyName = inv.company_name || 'Your Contractor';

    await transporter.sendMail({
      from,
      to,
      subject: `Invoice ${inv.invoice_number} from ${companyName} — ${total}`,
      html: `<div style="font-family: -apple-system, sans-serif; max-width: 540px; margin: 0 auto; padding: 32px;">
        <h2 style="margin: 0 0 8px;">Invoice ${inv.invoice_number}</h2>
        <p style="color: #555; font-size: 15px; margin: 0 0 24px;">From <strong>${companyName}</strong></p>
        <div style="background: #f8f9fa; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
          <div style="display: flex; justify-content: space-between; margin-bottom: 12px;">
            <span style="color: #666;">Amount Due</span>
            <span style="font-size: 20px; font-weight: 700; color: #1a1a2e;">${total}</span>
          </div>
          <div style="display: flex; justify-content: space-between;">
            <span style="color: #666;">Due Date</span>
            <span style="font-weight: 600;">${dueDate}</span>
          </div>
        </div>
        ${inv.notes ? `<p style="color: #555; font-size: 14px; line-height: 1.6;">${inv.notes}</p>` : ''}
        <p style="color: #888; font-size: 12px; margin-top: 32px;">
          Questions? Contact ${companyName}${inv.company_phone ? ` at ${inv.company_phone}` : ''}.
        </p>
      </div>`,
    });

    // Mark as sent if still draft
    if (inv.status === 'draft') {
      await invoiceService.sendInvoice(req.tenantId, req.params.id);
    }

    res.json({ success: true, message: `Invoice sent to ${to}` });
  } catch (err) {
    if (err.code === 'ECONNREFUSED' || err.code === 'ESOCKET' || err.responseCode) {
      return res.status(400).json({ error: `Email delivery failed: ${err.message}` });
    }
    next(err);
  }
});

export default router;
