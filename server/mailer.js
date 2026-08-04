// Sends email via MailerSend's HTTP API (https://mailersend.com) over
// regular HTTPS, port 443 — not SMTP. Vercel (and most serverless hosts)
// blocks or badly mishandles outbound SMTP connections, so an HTTP-based
// provider is required here, not a plain nodemailer/SMTP setup.
//
// Email is optional: if MAILERSEND_API_KEY isn't set, sendEmail just logs
// the content to the console instead of failing, so registration/reset
// still work during local dev or before you've set up an email provider.

const MAILERSEND_API_KEY = process.env.MAILERSEND_API_KEY;
const MAILERSEND_FROM = process.env.MAILERSEND_FROM || '';
const MAILERSEND_FROM_NAME = process.env.MAILERSEND_FROM_NAME || 'Rollr';

export const emailEnabled = !!(MAILERSEND_API_KEY && MAILERSEND_FROM);

function logFallback(to, subject, text) {
  console.log(`[mailer] Could not email ${to} — logging instead: ${subject}\n${text}`);
}

export async function sendEmail({ to, subject, html, text }) {
  if (!emailEnabled) {
    logFallback(to, subject, text);
    return false;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);

  try {
    const res = await fetch('https://api.mailersend.com/v1/email', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${MAILERSEND_API_KEY}`,
        'Content-Type': 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
      },
      body: JSON.stringify({
        from: { email: MAILERSEND_FROM, name: MAILERSEND_FROM_NAME },
        to: [{ email: to }],
        subject,
        html,
        text,
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      let data = null;
      try {
        data = await res.json();
      } catch {
        // response wasn't JSON — fall through with data left null
      }

      // Trial/unverified accounts are often restricted to only sending to
      // the account's own admin address, or to a limited set of
      // recipients until a domain is verified. Rather than breaking
      // registration for everyone else, fall back to logging the code —
      // relay it manually until the sender/domain is fully verified.
      if (res.status === 401 || res.status === 403 || res.status === 422) {
        logFallback(to, subject, text);
        return false;
      }

      throw new Error(data?.message || `MailerSend API error (${res.status})`);
    }
    return true;
  } finally {
    clearTimeout(timeout);
  }
}
