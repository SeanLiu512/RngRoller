import 'dotenv/config';
import 'express-async-errors';
import express from 'express';
import cors from 'cors';

import { attachUser } from './auth.js';
import authRoutes from './routes/auth.js';
import entityRoutes from './routes/entities.js';
import uploadRoutes from './routes/uploads.js';
import pusherAuthRoutes from './routes/pusher.js';
import gameRoutes from './routes/game.js';
import { rateLimit, securityHeaders } from './security.js';

// Last line of defense: log and keep running instead of crashing the whole
// process on an error that somehow escapes Express's request handling.
process.on('unhandledRejection', (reason) => {
  console.error('Unhandled promise rejection:', reason);
});
process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err);
});

export const app = express();

const allowedOrigins = [process.env.APP_URL, ...(process.env.CORS_ORIGIN || '').split(',')]
  .map((origin) => origin.trim().replace(/\/$/, ''))
  .filter(Boolean);

app.use(securityHeaders);
app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error('Origin not allowed'));
  },
  methods: ['GET', 'POST', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(rateLimit({ windowMs: 60_000, max: 180 }));
app.use(express.json({ limit: '64kb', strict: true }));
// Pusher's client-side auth request (for private/presence channels) sends
// its body as application/x-www-form-urlencoded by default, not JSON —
// without this, /api/pusher/auth silently received an empty body and
// always rejected the request with a 403.
app.use(express.urlencoded({ extended: true }));
app.use(attachUser);

app.use('/api/auth', rateLimit({ windowMs: 15 * 60_000, max: 20, key: (req) => `auth:${req.ip}` }), authRoutes);
app.use('/api/entities', entityRoutes);
app.use('/api/uploads', uploadRoutes);
app.use('/api/pusher', pusherAuthRoutes);
app.use('/api/game', gameRoutes);

app.get('/api/health', (_req, res) => res.json({ ok: true }));

// Must be registered last. Catches anything that threw/rejected in a route
// (thanks to express-async-errors above) so the client always gets a real
// response instead of the request hanging forever.
app.use((err, _req, res, _next) => {
  console.error('Unhandled request error:', err);
  if (res.headersSent) return;
  const status = Number.isInteger(err.status) ? err.status : 500;
  res.status(status).json({ message: status >= 500 ? 'Something went wrong on the server.' : err.message });
});

export default app;
