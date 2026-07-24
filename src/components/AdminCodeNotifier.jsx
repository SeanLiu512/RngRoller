import { useEffect, useRef } from 'react';
import { db } from '@/api/client';
import { useAuth } from '@/lib/AuthContext';
import { toast } from '@/components/ui/use-toast';

const POLL_INTERVAL_MS = 10_000;

// Renders nothing — just polls for pending verification codes in the
// background while an admin is logged in, and toasts a notification the
// moment a new one shows up, so the admin doesn't have to keep the Codes
// tab open and manually refresh it.
export default function AdminCodeNotifier() {
  const { user, isAuthenticated } = useAuth();
  const isAdmin = isAuthenticated && user?.role === 'admin';
  const seenRef = useRef(new Set());
  const initializedRef = useRef(false);

  useEffect(() => {
    if (!isAdmin) {
      // Reset so a fresh admin session starts clean if they log out/in.
      seenRef.current = new Set();
      initializedRef.current = false;
      return;
    }

    let cancelled = false;

    async function poll() {
      try {
        const codes = await db.auth.pendingCodes();
        if (cancelled) return;

        if (!initializedRef.current) {
          // First load: remember what's already pending without notifying,
          // so the admin isn't spammed with toasts for old codes the
          // moment they log in.
          for (const c of codes) seenRef.current.add(`${c.email}:${c.code}`);
          initializedRef.current = true;
          return;
        }

        for (const c of codes) {
          const key = `${c.email}:${c.code}`;
          if (!seenRef.current.has(key)) {
            seenRef.current.add(key);
            toast({
              title: 'New verification code',
              description: `${c.email} → ${c.code}`,
            });
          }
        }
      } catch {
        // Silently ignore — this is a background convenience feature, not
        // something that should interrupt the admin with error toasts.
      }
    }

    poll();
    const interval = setInterval(poll, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [isAdmin]);

  return null;
}
