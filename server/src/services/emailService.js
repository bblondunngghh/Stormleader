import nodemailer from 'nodemailer';
import config from '../config/env.js';
import logger from '../utils/logger.js';
import pool from '../db/pool.js';

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;

  if (!config.SMTP_HOST) {
    logger.warn('SMTP not configured — email alerts will be logged but not sent');
    return null;
  }

  transporter = nodemailer.createTransport({
    host: config.SMTP_HOST,
    port: config.SMTP_PORT,
    secure: config.SMTP_PORT === 465,
    auth: config.SMTP_USER ? {
      user: config.SMTP_USER,
      pass: config.SMTP_PASS,
    } : undefined,
  });

  return transporter;
}

/**
 * Create a transporter from tenant SMTP settings stored in branding JSONB.
 * Falls back to the global env transporter if tenant SMTP is not configured.
 */
export function getTenantTransporter(branding) {
  if (!branding?.smtp_host || !branding?.smtp_pass) {
    return getTransporter();
  }
  return nodemailer.createTransport({
    host: branding.smtp_host,
    port: branding.smtp_port || 587,
    secure: (branding.smtp_port || 587) === 465,
    auth: branding.smtp_user ? { user: branding.smtp_user, pass: branding.smtp_pass } : undefined,
  });
}

/**
 * Send a storm alert email.
 * Falls back to console logging if SMTP is not configured.
 */
export async function sendStormEmail(to, alertData, { senderEmail } = {}) {
  const transport = getTransporter();
  const from = senderEmail || config.SMTP_FROM || '"StormLeads Alerts" <alerts@stormleads.io>';

  if (!transport) {
    logger.info({ to, from, subject: alertData.subject }, 'Email alert (SMTP not configured, logging only)');
    return { messageId: `log-${Date.now()}`, logged: true };
  }

  const result = await transport.sendMail({
    from,
    to,
    subject: alertData.subject,
    html: alertData.emailHtml,
    text: alertData.smsBody, // plain text fallback
  });

  logger.info({ to, messageId: result.messageId }, 'Storm alert email sent');
  return result;
}

/**
 * Send an estimate email to a customer with a link to view/accept/decline.
 */
export async function sendEstimateEmail(to, estimate, appUrl, { senderEmail } = {}) {
  const transport = getTransporter();
  const viewUrl = `${appUrl}/estimate/${estimate.public_token}`;
  const subject = `Your Estimate ${estimate.estimate_number} from ${estimate.company_name || 'StormLeads Roofing'}`;

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
      <h2 style="color: #1a1a2e; margin: 0 0 8px;">${estimate.company_name || 'StormLeads Roofing'}</h2>
      <p style="color: #666; margin: 0 0 24px;">Professional Roofing Services</p>
      <hr style="border: none; border-top: 1px solid #e5e5e5; margin: 0 0 24px;" />
      <p style="color: #333; font-size: 16px; line-height: 1.6;">
        Hi${estimate.customer_name ? ' ' + estimate.customer_name.split(' ')[0] : ''},
      </p>
      <p style="color: #333; font-size: 16px; line-height: 1.6;">
        We've prepared an estimate for you. Please review the details below and let us know if you'd like to proceed.
      </p>
      <div style="background: #f8f9fa; border-radius: 8px; padding: 20px; margin: 24px 0;">
        <p style="margin: 0 0 8px; color: #666; font-size: 13px; text-transform: uppercase; letter-spacing: 0.05em;">Estimate ${estimate.estimate_number}</p>
        <p style="margin: 0; color: #1a1a2e; font-size: 28px; font-weight: 700;">$${Number(estimate.total).toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
      </div>
      <a href="${viewUrl}" style="display: inline-block; background: #3b82f6; color: #fff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-size: 16px; font-weight: 600;">
        View Estimate
      </a>
      <p style="color: #999; font-size: 13px; margin-top: 32px;">
        You can review, accept, or decline this estimate using the link above.
        ${estimate.valid_until ? `This estimate is valid until ${new Date(estimate.valid_until).toLocaleDateString()}.` : ''}
      </p>
    </div>
  `;

  const text = `Estimate ${estimate.estimate_number} - $${Number(estimate.total).toFixed(2)}\n\nView your estimate: ${viewUrl}`;

  const from = senderEmail || config.SMTP_FROM || '"StormLeads" <estimates@stormleads.io>';

  if (!transport) {
    logger.info({ to, from, subject, viewUrl }, 'Estimate email (SMTP not configured, logging only)');
    return { messageId: `log-${Date.now()}`, logged: true };
  }

  const result = await transport.sendMail({
    from,
    to,
    subject,
    html,
    text,
  });

  logger.info({ to, messageId: result.messageId, estimateId: estimate.id }, 'Estimate email sent');
  return result;
}

/**
 * Send a simple automation-triggered email to a lead contact.
 */
export async function sendAutomationEmail(to, { subject, body, contactName }) {
  const transport = getTransporter();
  const from = config.SMTP_FROM || '"StormLeads" <noreply@stormleads.io>';

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
      <p style="color: #333; font-size: 16px; line-height: 1.6;">
        Hi${contactName ? ' ' + contactName.split(' ')[0] : ''},
      </p>
      <div style="color: #333; font-size: 16px; line-height: 1.6; white-space: pre-wrap;">${body}</div>
    </div>
  `;

  if (!transport) {
    logger.info({ to, from, subject }, 'Automation email (SMTP not configured, logging only)');
    return { messageId: `log-${Date.now()}`, logged: true };
  }

  const result = await transport.sendMail({ from, to, subject, html, text: body });
  logger.info({ to, messageId: result.messageId }, 'Automation email sent');
  return result;
}

/**
 * Send overdue invoice payment reminders.
 * Finds invoices with status 'sent' that are past due and haven't been reminded in 7 days.
 */
export async function sendOverdueInvoiceReminders() {
  const { rows: overdueInvoices } = await pool.query(`
    SELECT i.*, t.name AS company_name, t.sender_email, t.branding,
           l.contact_name, l.contact_email
    FROM invoices i
    JOIN tenants t ON t.id = i.tenant_id
    LEFT JOIN leads l ON l.id = i.lead_id AND l.tenant_id = i.tenant_id
    WHERE i.status = 'sent'
      AND i.due_date < NOW()
      AND (i.last_reminder_at IS NULL OR i.last_reminder_at < NOW() - INTERVAL '7 days')
      AND l.contact_email IS NOT NULL
  `);

  for (const inv of overdueInvoices) {
    try {
      const daysOverdue = Math.floor((Date.now() - new Date(inv.due_date).getTime()) / 86400000);
      const companyName = inv.company_name || 'Your Contractor';
      const transport = getTenantTransporter(inv.branding);
      const from = inv.sender_email || config.SMTP_FROM || '"StormLeads" <noreply@stormleads.io>';

      if (!transport) {
        logger.info({ invoiceId: inv.id, to: inv.contact_email }, 'Overdue reminder (SMTP not configured, logging only)');
        await pool.query('UPDATE invoices SET last_reminder_at = NOW() WHERE id = $1', [inv.id]);
        continue;
      }

      await transport.sendMail({
        from,
        to: inv.contact_email,
        subject: `Payment Reminder: Invoice ${inv.invoice_number} — ${daysOverdue} days overdue`,
        html: `<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 500px; margin: 0 auto; padding: 32px;">
          <h2>Payment Reminder</h2>
          <p>Hi ${inv.contact_name ? inv.contact_name.split(' ')[0] : 'there'},</p>
          <p>This is a friendly reminder that invoice <strong>${inv.invoice_number}</strong> for
          <strong>$${Number(inv.total || 0).toLocaleString()}</strong> was due on
          ${new Date(inv.due_date).toLocaleDateString()} (${daysOverdue} days ago).</p>
          <p>If you've already sent payment, please disregard this notice.</p>
          <p>Thank you,<br/>${companyName}</p>
        </div>`,
        text: `Payment Reminder: Invoice ${inv.invoice_number} for $${Number(inv.total || 0).toLocaleString()} was due on ${new Date(inv.due_date).toLocaleDateString()} (${daysOverdue} days ago). If you've already sent payment, please disregard this notice. — ${companyName}`,
      });

      await pool.query('UPDATE invoices SET last_reminder_at = NOW() WHERE id = $1', [inv.id]);
      logger.info({ invoiceId: inv.id, to: inv.contact_email }, `Sent overdue reminder for invoice ${inv.invoice_number}`);
    } catch (err) {
      logger.warn({ invoiceId: inv.id, err: err.message }, `Failed to send reminder for invoice ${inv.id}`);
    }
  }
}
