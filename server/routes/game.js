import { Router } from 'express';
import { prisma } from '../db.js';
import { requireAuth } from '../auth.js';
import { analyzeRoll, getRarityRank, SHOP_ITEMS } from '../../src/lib/rollEngine.js';

const router = Router();
const COOLDOWN_MS = 60_000;
const today = () => new Date().toISOString().slice(0, 10);

router.post('/roll', requireAuth, async (req, res) => {
  const result = await prisma.$transaction(async (tx) => {
    const last = await tx.roll.findFirst({
      where: { created_by_id: req.user.id },
      orderBy: { createdAt: 'desc' },
    });
    if (last && Date.now() - last.createdAt.getTime() < COOLDOWN_MS) {
      const error = new Error('Please wait before rolling again');
      error.status = 429;
      throw error;
    }

    const freshUser = await tx.user.findUnique({ where: { id: req.user.id } });
    const boost = freshUser.active_boost;
    let number = Math.floor(Math.random() * 1_000_001);
    let roll = analyzeRoll(number);
    if (boost === 'lucky_charm' && getRarityRank(roll.rarity) < getRarityRank('uncommon')) {
      const candidate = analyzeRoll(Math.floor(Math.random() * 1_000_001));
      if (candidate.ep > roll.ep) roll = candidate;
    }
    if (boost === '2x_ep') roll.ep *= 2;
    if (boost === '5x_ep') roll.ep *= 5;

    await tx.user.update({ where: { id: req.user.id }, data: { active_boost: '' } });
    return tx.roll.create({ data: {
      ...roll,
      roll_date: today(),
      roller_name: freshUser.email.split('@')[0],
      equipped_badge: freshUser.equipped_badge,
      custom_badge_name: freshUser.custom_badge_name,
      custom_badge_image: freshUser.custom_badge_image,
      roller_vip: freshUser.store_unlocks.includes('vip_title'),
      created_by_id: req.user.id,
      created_by: req.user.email,
    }});
  });
  res.json(result);
});

router.post('/purchase', requireAuth, async (req, res) => {
  const item = SHOP_ITEMS.find((candidate) => candidate.id === req.body?.itemId);
  if (!item) return res.status(400).json({ message: 'Invalid shop item' });
  const purchase = await prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({ where: { id: req.user.id } });
    const earned = await tx.roll.aggregate({ where: { created_by_id: req.user.id }, _sum: { ep: true } });
    const available = (earned._sum.ep || 0) - user.ep_spent;
    if (available < item.price) throw new Error('Not enough EP');
    if (item.type === 'permanent' && user.store_unlocks.includes(item.id)) throw new Error('Already owned');
    if (item.type === 'consumable' && user.active_boost) throw new Error('Use your current boost first');
    return tx.user.update({ where: { id: user.id }, data: item.type === 'consumable'
      ? { ep_spent: { increment: item.price }, active_boost: item.id }
      : { ep_spent: { increment: item.price }, store_unlocks: { push: item.id } },
    });
  });
  res.json(purchase);
});

export default router;
