import { Router } from 'express';
import { pusher, pusherEnabled } from '../pusher.js';
import { requireAuth } from '../auth.js';

const router = Router();

// Deterministic color per user, so the same player looks the same color
// across reconnects (based on a hash of their id, not random).
function colorForId(id) {
  let hash = 0;
  for (const ch of id) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  const hue = hash % 360;
  return `hsl(${hue}, 75%, 60%)`;
}

// Only ever authorizes the single shared arena presence channel — anything
// else is rejected, so this endpoint can't be used to snoop on/join other
// channels.
router.post('/auth', requireAuth, (req, res) => {
  if (!pusherEnabled) return res.status(503).json({ message: 'Realtime is not configured on this server.' });

  const { socket_id: socketId, channel_name: channelName } = req.body || {};
  if (!socketId || channelName !== 'presence-arena') {
    return res.status(403).json({ message: 'Not allowed' });
  }

  const presenceData = {
    user_id: req.user.id,
    user_info: {
      name: req.user.email.split('@')[0],
      color: colorForId(req.user.id),
    },
  };

  const authResponse = pusher.authorizeChannel(socketId, channelName, presenceData);
  res.json(authResponse);
});

export default router;
