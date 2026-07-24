import { Router } from 'express';
import { prisma } from '../db.js';
import { requireAuth, requireAdmin, publicUser } from '../auth.js';

const router = Router();

const MODELS = {
  Roll: prisma.roll,
  ArenaMatch: prisma.arenaMatch,
};

// Maps the client's Base44-style sort/filter field names onto Prisma's.
function mapSortField(field) {
  if (field === 'created_date') return 'createdAt';
  return field;
}

function parseSort(sortParam) {
  if (!sortParam) return { createdAt: 'desc' };
  const desc = sortParam.startsWith('-');
  const field = mapSortField(desc ? sortParam.slice(1) : sortParam);
  return { [field]: desc ? 'desc' : 'asc' };
}

// Translates a Base44-style filter object (supports plain equality and
// { $gte: value } / { $lte: value } / { $gt: value } / { $lt: value }) into
// a Prisma `where` clause.
function parseWhere(filterParam) {
  if (!filterParam) return {};
  let filter;
  try {
    filter = typeof filterParam === 'string' ? JSON.parse(filterParam) : filterParam;
  } catch {
    return {};
  }
  const where = {};
  for (const [key, value] of Object.entries(filter)) {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      const cond = {};
      if ('$gte' in value) cond.gte = value.$gte;
      if ('$lte' in value) cond.lte = value.$lte;
      if ('$gt' in value) cond.gt = value.$gt;
      if ('$lt' in value) cond.lt = value.$lt;
      where[key] = cond;
    } else {
      where[key] = value;
    }
  }
  return where;
}

// ── User entity: admin-only listing / role & ban management ──
// Registered before the generic `/:name/:id` routes below so they take
// precedence for the User entity (which isn't in MODELS).
router.get('/User/list-all', requireAdmin, async (req, res) => {
  const users = await prisma.user.findMany({ orderBy: { createdAt: 'desc' } });
  res.json(users.map(publicUser));
});

router.patch('/User/:id', requireAdmin, async (req, res) => {
  const allowed = ['role', 'banned'];
  const data = {};
  for (const key of allowed) {
    if (key in (req.body || {})) data[key] = req.body[key];
  }
  const user = await prisma.user.update({ where: { id: req.params.id }, data });
  res.json(publicUser(user));
});

// ── Roll / ArenaMatch: generic list+filter+create+update+delete ──
router.get('/:name', async (req, res) => {
  const { name } = req.params;
  const model = MODELS[name];
  if (!model) return res.status(404).json({ message: `Unknown entity: ${name}` });

  const where = parseWhere(req.query.filter);
  const orderBy = parseSort(req.query.sort);
  const take = req.query.limit ? Number(req.query.limit) : undefined;

  const rows = await model.findMany({ where, orderBy, take });
  res.json(rows);
});

router.post('/:name', requireAuth, async (req, res) => {
  const { name } = req.params;
  const model = MODELS[name];
  if (!model) return res.status(404).json({ message: `Unknown entity: ${name}` });

  const data = { ...req.body, created_by_id: req.user.id, created_by: req.user.email };
  const row = await model.create({ data });
  res.json(row);
});

router.patch('/:name/:id', requireAuth, async (req, res) => {
  const { name, id } = req.params;
  const model = MODELS[name];
  if (!model) return res.status(404).json({ message: `Unknown entity: ${name}` });

  const existing = await model.findUnique({ where: { id } });
  if (!existing) return res.status(404).json({ message: 'Not found' });
  // Matches this app's RLS rule: only the creator (or an admin) may update.
  if (existing.created_by_id !== req.user.id && req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Not allowed to update this record' });
  }

  const row = await model.update({ where: { id }, data: req.body });
  res.json(row);
});

router.delete('/:name/:id', requireAdmin, async (req, res) => {
  const { name, id } = req.params;
  const model = MODELS[name];
  if (!model) return res.status(404).json({ message: `Unknown entity: ${name}` });
  await model.delete({ where: { id } });
  res.json({ ok: true });
});

export default router;
