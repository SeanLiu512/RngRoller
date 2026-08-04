import { Router } from 'express';
import crypto from 'crypto';
import { authenticator as totp } from 'otplib';
import QRCode from 'qrcode';
import { prisma } from '../db.js';
import {
  signToken, hashPassword, comparePassword, publicUser, requireAuth,
  SUPERADMIN_EMAIL, isSuperAdmin, signPendingTwoFactorToken, verifyPendingTwoFactorToken,
} from '../auth.js';
import { sendEmail, emailEnabled } from '../mailer.js';

const router = Router();

const TURNSTILE_SECRET_KEY = process.env.TURNSTILE_SECRET_KEY;

// Verifies a Cloudflare Turnstile token server-side. Returns true (skips
// verification) if TURNSTILE_SECRET_KEY isn't configured, so the app still
// works before this is set up.
async function verifyTurnstile(token) {
  if (!TURNSTILE_SECRET_KEY) return true;
  if (!token) return false;
  try {
    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ secret: TURNSTILE_SECRET_KEY, response: token }),
    });
    const data = await res.json();
    return !!data.success;
  } catch {
    return false;
  }
}

function otpCode() {
  return String(crypto.randomInt(100000, 1_000_000));
}

function normalizeEmail(value) {
  const email = String(value || '').toLowerCase().trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254 ? email : null;
}

function validPassword(value) {
  return typeof value === 'string' && value.length >= 12 && value.length <= 128;
}

function roleForEmail(email) {
  return email.toLowerCase() === SUPERADMIN_EMAIL ? 'superadmin' : 'user';
}

// Self-healing: if this user's email matches ADMIN_EMAIL but their stored
// role isn't 'admin' yet (e.g. they registered before ADMIN_EMAIL was set,
// or it was changed after the fact), promote them now. Called on login and
// on /me so it takes effect the moment they next authenticate — no manual
// database surgery needed.
async function ensureAdminRole(user) {
  if (user.email.toLowerCase() === SUPERADMIN_EMAIL && !isSuperAdmin(user)) {
    await prisma.user.updateMany({
      where: { role: 'superadmin', email: { not: SUPERADMIN_EMAIL } },
      data: { role: 'admin' },
    });
    return prisma.user.update({ where: { id: user.id }, data: { role: 'superadmin', banned: false } });
  }
  return user;
}

// ── Register (two-step: email first, then code + password together) ──

// Step 1: user submits just their email. We email them a 6-digit code.
// No user account is created yet — only after they submit the code.
router.post('/register-request', async (req, res) => {
  const { email, turnstileToken } = req.body || {};
  if (!email) return res.status(400).json({ message: 'Email is required' });
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) return res.status(400).json({ message: 'Enter a valid email address' });

  if (!(await verifyTurnstile(turnstileToken))) {
    return res.status(400).json({ message: 'Verification failed — please try again.' });
  }

  const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  if (existing && existing.emailVerified) {
    return res.status(409).json({ message: 'An account with this email already exists' });
  }

  const code = otpCode();
  await prisma.emailOtp.deleteMany({ where: { email: normalizedEmail } });
  await prisma.emailOtp.create({
    data: { email: normalizedEmail, code, expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) },
  });

  const delivered = await sendEmail({
    to: normalizedEmail,
    subject: 'Your verification code',
    text: `Your verification code is ${code}. It expires in 24 hours.`,
    html: `<p>Your verification code is <b>${code}</b>. It expires in 24 hours.</p>`,
  });

  res.json({ sent: true, emailDelivered: delivered });
});

router.post('/register-resend', async (req, res) => {
  const { email } = req.body || {};
  if (!email) return res.status(400).json({ message: 'Email is required' });
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) return res.status(400).json({ message: 'Enter a valid email address' });

  const code = otpCode();
  await prisma.emailOtp.deleteMany({ where: { email: normalizedEmail } });
  await prisma.emailOtp.create({
    data: { email: normalizedEmail, code, expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) },
  });

  const delivered = await sendEmail({
    to: normalizedEmail,
    subject: 'Your verification code',
    text: `Your verification code is ${code}. It expires in 24 hours.`,
    html: `<p>Your verification code is <b>${code}</b>. It expires in 24 hours.</p>`,
  });

  res.json({ sent: true, emailDelivered: delivered });
});

// Step 2: user submits the code together with their chosen password.
// This is what actually creates (or finalizes) the account.
router.post('/register-complete', async (req, res) => {
  const { email, otpCode: code, password } = req.body || {};
  if (!email || !code || !password) {
    return res.status(400).json({ message: 'Email, code, and password are required' });
  }
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) return res.status(400).json({ message: 'Enter a valid email address' });
  if (!validPassword(password)) return res.status(400).json({ message: 'Password must be 12 to 128 characters' });

  const otp = await prisma.emailOtp.findFirst({
    where: { email: normalizedEmail, code: String(code), expiresAt: { gt: new Date() } },
    orderBy: { createdAt: 'desc' },
  });
  if (!otp) return res.status(400).json({ message: 'Invalid or expired verification code' });

  const passwordHash = await hashPassword(password);
  const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });

  const user = existing
    ? await prisma.user.update({
        where: { email: normalizedEmail },
        data: { passwordHash, emailVerified: true },
      })
    : await prisma.user.create({
        data: {
          email: normalizedEmail,
          passwordHash,
          emailVerified: true,
          role: roleForEmail(normalizedEmail),
        },
      });

  await prisma.emailOtp.deleteMany({ where: { email: normalizedEmail } });
  res.json({ access_token: signToken(user) });
});

// ── Login ──
router.post('/login', async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ message: 'Email and password are required' });
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) return res.status(401).json({ message: 'Invalid email or password' });

  const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  if (!user || !user.passwordHash) return res.status(401).json({ message: 'Invalid email or password' });
  if (user.banned) return res.status(403).json({ message: 'Your account has been banned.' });

  const valid = await comparePassword(password, user.passwordHash);
  if (!valid) return res.status(401).json({ message: 'Invalid email or password' });

  if (emailEnabled && !user.emailVerified) {
    return res.status(403).json({ message: 'Please verify your email before logging in', needsVerification: true });
  }

  const finalUser = await ensureAdminRole(user);

  if (finalUser.twoFactorEnabled) {
    return res.json({ requires2FA: true, pendingToken: signPendingTwoFactorToken(finalUser) });
  }

  res.json({ access_token: signToken(finalUser) });
});

// Second step of login when 2FA is enabled: exchange the pending token +
// a valid 6-digit authenticator code for a real access token.
router.post('/2fa/login-verify', async (req, res) => {
  const { pendingToken, code } = req.body || {};
  if (!pendingToken || !code) return res.status(400).json({ message: 'Missing token or code' });

  let payload;
  try {
    payload = verifyPendingTwoFactorToken(pendingToken);
  } catch {
    return res.status(401).json({ message: 'Your session expired — please log in again.' });
  }

  const user = await prisma.user.findUnique({ where: { id: payload.sub } });
  if (!user || !user.twoFactorEnabled || !user.twoFactorSecret) {
    return res.status(401).json({ message: 'Two-factor authentication is not set up on this account.' });
  }
  if (user.banned) return res.status(403).json({ message: 'Your account has been banned.' });

  const valid = totp.check(String(code).trim(), user.twoFactorSecret);
  if (!valid) return res.status(401).json({ message: 'Invalid or expired code.' });

  res.json({ access_token: signToken(user) });
});

// ── Password reset ──
router.post('/reset-password-request', async (req, res) => {
  const { email } = req.body || {};
  const normalizedEmail = normalizeEmail(email);
  const user = normalizedEmail ? await prisma.user.findUnique({ where: { email: normalizedEmail } }) : null;

  // Always respond success-shaped, regardless of whether the account exists.
  if (user) {
    const token = crypto.randomBytes(32).toString('hex');
    await prisma.passwordResetToken.create({
      data: { token, email: normalizedEmail, expiresAt: new Date(Date.now() + 60 * 60 * 1000) },
    });
    const appUrl = process.env.APP_URL || '';
    const link = `${appUrl}/reset-password?token=${token}`;
    if (emailEnabled) {
      await sendEmail({
        to: normalizedEmail,
        subject: 'Reset your password',
        text: `Reset your password: ${link}`,
        html: `<p><a href="${link}">Click here to reset your password</a>. This link expires in 1 hour.</p>`,
      });
    } else {
      console.log(`[auth] Password reset link for ${normalizedEmail}: ${link}`);
    }
  }
  res.json({ ok: true });
});

router.post('/reset-password', async (req, res) => {
  const { resetToken, newPassword } = req.body || {};
  if (!resetToken || !newPassword) return res.status(400).json({ message: 'Missing token or new password' });
  if (!validPassword(newPassword)) return res.status(400).json({ message: 'Password must be 12 to 128 characters' });

  const record = await prisma.passwordResetToken.findUnique({ where: { token: resetToken } });
  if (!record || record.expiresAt < new Date()) {
    return res.status(400).json({ message: 'This reset link is invalid or has expired' });
  }

  const passwordHash = await hashPassword(newPassword);
  await prisma.user.update({ where: { email: record.email }, data: { passwordHash } });
  await prisma.passwordResetToken.delete({ where: { token: resetToken } });

  res.json({ ok: true });
});

// ── Current user ──
router.get('/me', requireAuth, async (req, res) => {
  const user = await ensureAdminRole(req.user);
  res.json(publicUser(user));
});

router.patch('/me', requireAuth, async (req, res) => {
  const allowed = [
    'equipped_badge',
    'custom_badge_name',
    'custom_badge_image',

  ];
  const data = {};
  for (const key of allowed) {
    if (key in (req.body || {})) data[key] = req.body[key];
  }
  const user = await prisma.user.update({ where: { id: req.user.id }, data });
  res.json(publicUser(user));
});

// ── Two-factor authentication (TOTP, via an authenticator app) ──

// Step 1: generate a new secret and a QR code to scan. Not enabled yet —
// that only happens once they prove they can actually generate a valid
// code with it, in /2fa/verify-setup below.
router.post('/2fa/setup', requireAuth, async (req, res) => {
  const secret = totp.generateSecret();
  await prisma.user.update({ where: { id: req.user.id }, data: { twoFactorSecret: secret } });

  const otpauthUrl = totp.keyuri(req.user.email, 'Rollr', secret);
  const qrCodeDataUrl = await QRCode.toDataURL(otpauthUrl);

  res.json({ secret, qrCodeDataUrl });
});

// Step 2: confirm they can generate a valid code before actually turning
// 2FA on — this prevents someone from locking themselves out with a
// secret they never actually saved into their authenticator app.
router.post('/2fa/verify-setup', requireAuth, async (req, res) => {
  const { code } = req.body || {};
  if (!req.user.twoFactorSecret) return res.status(400).json({ message: 'Start setup first.' });
  if (!code || !totp.check(String(code).trim(), req.user.twoFactorSecret)) {
    return res.status(400).json({ message: 'Invalid code — check your authenticator app and try again.' });
  }
  const user = await prisma.user.update({ where: { id: req.user.id }, data: { twoFactorEnabled: true } });
  res.json(publicUser(user));
});

// Disable 2FA — requires the current password, so a stolen session token
// alone can't be used to turn off this protection.
router.post('/2fa/disable', requireAuth, async (req, res) => {
  const { password } = req.body || {};
  if (!password || !req.user.passwordHash || !(await comparePassword(password, req.user.passwordHash))) {
    return res.status(401).json({ message: 'Incorrect password.' });
  }
  const user = await prisma.user.update({
    where: { id: req.user.id },
    data: { twoFactorEnabled: false, twoFactorSecret: null },
  });
  res.json(publicUser(user));
});

// ── Admin: view pending verification codes ──
// Lets the admin relay a code to someone manually (from inside the app)
// when email delivery isn't set up yet / gets blocked by the provider.
router.get('/pending-codes', requireAuth, async (req, res) => {
  if (req.user.role !== 'admin' && !isSuperAdmin(req.user)) return res.status(403).json({ message: 'Admin access required' });

  const codes = await prisma.emailOtp.findMany({
    where: { expiresAt: { gt: new Date() } },
    orderBy: { createdAt: 'desc' },
    select: { email: true, code: true, expiresAt: true, createdAt: true },
  });
  res.json(codes);
});

export default router;
