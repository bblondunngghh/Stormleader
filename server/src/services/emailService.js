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
export async function sendStormEmail(to, alertData) {
  const transport = getTransporter();

  if (!transport) {
    logger.info({ to, subject: alertData.subject }, 'Email alert (SMTP not configured, logging only)');
    return { messageId: `log-${Date.now()}`, logged: true };
  }

  const result = await transport.sendMail({
    from: config.SMTP_FROM || '"StormLeads Alerts" <alerts@stormleads.io>',
    to,
    subject: alertData.subject,
    html: alertData.emailHtml,
    text: alertData.smsBody, // plain text fallback
  });

  logger.info({ to, messageId: result.messageId }, 'Storm alert email sent');
  return result;
}
