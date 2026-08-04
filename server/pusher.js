import Pusher from 'pusher';

// Only constructed if all 4 keys are present — arena multiplayer routes
// check `pusherEnabled` before using this, so the app still runs fine
// without Pusher configured (arena just stays solo/practice-only).
export const pusherEnabled = !!(
  process.env.PUSHER_APP_ID &&
  process.env.PUSHER_KEY &&
  process.env.PUSHER_SECRET &&
  process.env.PUSHER_CLUSTER
);

export const pusher = pusherEnabled
  ? new Pusher({
      appId: process.env.PUSHER_APP_ID,
      key: process.env.PUSHER_KEY,
      secret: process.env.PUSHER_SECRET,
      cluster: process.env.PUSHER_CLUSTER,
      useTLS: true,
    })
  : null;
