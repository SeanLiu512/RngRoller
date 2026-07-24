import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { prisma } from './db.js';

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  // Fail loudly rather than silently signing tokens with a guessable default.
  throw new Error('JWT_SECRET environment variable is required.');
}

export function signToken(user) {
  return jwt.sign({ sub: user.id }, JWT_SECRET, { expiresIn: '30d' });
}

export function hashPassword(password) {
  return bcrypt.hash(password, 10);
}

export function comparePassword(password, hash) {
  return bcrypt.compare(password, hash);
}

export function publicUser(user) {
  if (!user) return null;
  const { passwordHash, ...rest } = user;
  return rest;
}

// Attaches req.user if a valid token is present; does not reject otherwise.
export async function attachUser(req, _res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return next();
  try {
    const payload = jwt.verify(token, JWT_SECRET);
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

export function requireAdmin(req, res, next) {
  if (!req.user) return res.status(401).json({ message: 'Authentication required' });
  if (req.user.role !== 'admin') return res.status(403).json({ message: 'Admin access required' });
  next();
}
