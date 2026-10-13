/**
 * Email notifier. Interface: send({ to, subject, text, html }) -> { mode, messageId, previewUrl? }
 * To add SMS later, create notifiers/smsNotifier.js with the same send() shape.
 *
 * Transport selection (EMAIL_MODE=smtp|ethereal|outbox, otherwise automatic):
 *   1. SMTP_HOST set        -> real SMTP (Gmail, SendGrid, ...)
 *   2. Ethereal test inbox  -> free fake SMTP; returns a preview URL (needs internet)
 *   3. Local outbox         -> no network at all; the email is stored and viewable in the app
 */
const nodemailer = require('nodemailer');
const env = require('../config/env');

let cached = null;

const withTimeout = (p, ms) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms))]);

async function buildTransport() {
  const mode = env.EMAIL_MODE;
  if (mode === 'outbox') return { mode: 'outbox', transport: nodemailer.createTransport({ jsonTransport: true }) };

  if (mode === 'smtp' || (!mode && env.SMTP_HOST)) {
    return {
      mode: 'smtp',
      transport: nodemailer.createTransport({
        host: env.SMTP_HOST, port: env.SMTP_PORT, secure: env.SMTP_PORT === 465,
        auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
      }),
    };
  }

  try {
    const account = await withTimeout(nodemailer.createTestAccount(), 6000);
    console.log(`[mail] Using Ethereal test inbox (${account.user}). Preview links appear in the Alerts page.`);
    return {
      mode: 'ethereal',
      transport: nodemailer.createTransport({
        host: account.smtp.host, port: account.smtp.port, secure: account.smtp.secure,
        auth: { user: account.user, pass: account.pass },
      }),
    };
  } catch {
    console.log('[mail] Ethereal unreachable; using the local outbox (emails are viewable from the Alerts page).');
    return { mode: 'outbox', transport: nodemailer.createTransport({ jsonTransport: true }) };
  }
}

async function getTransport() {
  if (!cached) cached = buildTransport();
  return cached;
}

async function send({ to, subject, text, html }) {
  const { mode, transport } = await getTransport();
  const info = await transport.sendMail({ from: env.MAIL_FROM, to, subject, text, html });
  const previewUrl = mode === 'ethereal' ? nodemailer.getTestMessageUrl(info) || undefined : undefined;
  return { mode, messageId: info.messageId, previewUrl };
}

/** Test helper: forget the cached transport. */
const reset = () => { cached = null; };

module.exports = { send, reset };
