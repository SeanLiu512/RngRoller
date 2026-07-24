import 'dotenv/config';
import 'express-async-errors';
import express from 'express';
import cors from 'cors';

import { attachUser } from './auth.js';
import authRoutes from './routes/auth.js';
import entityRoutes from './routes/entities.js';
import uploadRoutes from './routes/uploads.js';

// Last line of defense: log and keep running instead of crashing the whole
// process on an error that somehow escapes Express's request handling.
process.on('unhandledRejection', (reason) => {
  console.error('Unhandled promise rejection:', reason);
});
process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err);
});

export const app = express();

app.use(cors());
app.use(express.json({ limit: '2mb' }));
app.use(attachUser);

app.use('/api/auth', authRoutes);
app.use('/api/entities', entityRoutes);
app.use('/api/uploads', uploadRoutes);

app.get('/api/health', (_req, res) => res.json({ ok: true }));

// Must be registered last. Catches anything that threw/rejected in a route
// (thanks to express-async-errors above) so the client always gets a real
// response instead of the request hanging forever.
app.use((err, _req, res, _next) => {
  console.error('Unhandled request error:', err);
  if (res.headersSent) return;
  res.status(500).json({ message: err.message || 'Something went wrong on the server.' });
});

export default app;
