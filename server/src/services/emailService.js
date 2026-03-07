import nodemailer from 'nodemailer';
import config from '../config/env.js';
import logger from '../utils/logger.js';

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
