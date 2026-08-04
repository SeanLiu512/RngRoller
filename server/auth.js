import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { prisma } from './db.js';

const JWT_SECRET = process.env.JWT_SECRET;
// This is the only SuperAdmin identity. Role checks also verify this email,
// so no other database row can gain SuperAdmin powers.
export const SUPERADMIN_EMAIL = 'seanliu512@hotmail.com';
if (!JWT_SECRET) {
  // Fail loudly rather than silently signing tokens with a guessable default.
  throw new Error('JWT_SECRET environment variable is required.');
}

export function signToken(user) {
  return jwt.sign({ sub: user.id }, JWT_SECRET, { expiresIn: '30d' });
}

// A short-lived, narrowly-scoped token issued after a correct password but
// before the 2FA code is verified. It carries a `purpose` claim so it can
// never be used as a real login token — attachUser below explicitly
// rejects any token that has one.
export function signPendingTwoFactorToken(user) {
  return jwt.sign({ sub: user.id, purpose: '2fa-pending' }, JWT_SECRET, { expiresIn: '5m' });
}

export function verifyPendingTwoFactorToken(token) {
  const payload = jwt.verify(token, JWT_SECRET);
  if (payload.purpose !== '2fa-pending') throw new Error('Not a valid 2FA session token');
  return payload;
}

export function hashPassword(password) {
  return bcrypt.hash(password, 10);
}

export function comparePassword(password, hash) {
  return bcrypt.compare(password, hash);
}

export function publicUser(user) {
  if (!user) return null;
  const { passwordHash, twoFactorSecret, ...rest } = user;
  return rest;
}

// Attaches req.user if a valid token is present; does not reject otherwise.
export async function attachUser(req, _res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return next();
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    // A pending-2FA token must NEVER grant access to anything — it exists
    // solely to be exchanged for a real token via the 2FA verify endpoint.
    if (payload.purpose) return next();
    const user = await prisma.user.findUnique({ where: { id: payload.sub } });
    if (user) req.user = user;
  } catch {
    // invalid/expired token — treat as unauthenticated
  }
  next();
}

export function requireAuth(req, res, next) {
  if (!req.user) return res.status(401).json({ message: 'Authentication required' });
  if (req.user.banned) return res.status(403).json({ message: 'Your account has been banned.' });
  next();
}

export function isSuperAdmin(user) {
  return user?.role === 'superadmin' && user.email.toLowerCase() === SUPERADMIN_EMAIL;
}

export function requireAdmin(req, res, next) {
  if (!req.user) return res.status(401).json({ message: 'Authentication required' });
  if (req.user.role !== 'admin' && !isSuperAdmin(req.user)) {
    return res.status(403).json({ message: 'Admin access required' });
  }
  next();
}

export function requireSuperAdmin(req, res, next) {
  if (!req.user) return res.status(401).json({ message: 'Authentication required' });
  if (!isSuperAdmin(req.user)) return res.status(403).json({ message: 'SuperAdmin access required' });
  next();
}
