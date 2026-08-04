import Pusher from 'pusher-js';

const PUSHER_KEY = import.meta.env.VITE_PUSHER_KEY;
const PUSHER_CLUSTER = import.meta.env.VITE_PUSHER_CLUSTER;
const API_BASE = import.meta.env.VITE_API_URL || '';

export const realtimeEnabled = !!(PUSHER_KEY && PUSHER_CLUSTER);

let clientInstance = null;

// One shared Pusher connection per browser tab, authenticated with the
// same JWT the rest of the app uses (read fresh each time a channel auth
// request is made, not baked in once at connection time).
export function getPusherClient() {
  if (!realtimeEnabled) return null;
  if (clientInstance) return clientInstance;

  clientInstance = new Pusher(PUSHER_KEY, {
    cluster: PUSHER_CLUSTER,
    channelAuthorization: {
      endpoint: `${API_BASE}/api/pusher/auth`,
      transport: 'ajax',
      headers: {
        get Authorization() {
          const token = localStorage.getItem('access_token');
          return token ? `Bearer ${token}` : '';
        },
      },
    },
  });

  return clientInstance;
}
