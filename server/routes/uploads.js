import { Router } from 'express';
import multer from 'multer';
import { prisma } from '../db.js';
import { requireAuth } from '../auth.js';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });
const router = Router();

// Stores the file as base64 directly in Postgres (simplest option for
// self-hosting without a separate object-storage service) and serves it
// back from GET /:id.
router.post('/', requireAuth, upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'No file provided' });
  const record = await prisma.upload.create({
    data: { mime: req.file.mimetype, data: req.file.buffer.toString('base64') },
  });
  res.json({ file_url: `/api/uploads/${record.id}` });
});

router.get('/:id', async (req, res) => {
  const record = await prisma.upload.findUnique({ where: { id: req.params.id } });
  if (!record) return res.status(404).send('Not found');
  res.set('Content-Type', record.mime);
  res.set('Cache-Control', 'public, max-age=31536000, immutable');
  res.send(Buffer.from(record.data, 'base64'));
});

export default router;
