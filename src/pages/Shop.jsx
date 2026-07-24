import { db } from '@/api/client';

import { useState, useEffect, useCallback } from 'react';

import { useAuth } from '@/lib/AuthContext';
import { SHOP_ITEMS, formatEP } from '@/lib/rollEngine';
import { ShoppingBag, Zap, Check, Lock } from 'lucide-react';

export default function Shop() {
  const { user, isAuthenticated, checkUserAuth } = useAuth();
  const [rolls, setRolls] = useState([]);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState(null);
  const [error, setError] = useState('');

  const fetchRolls = useCallback(async () => {
    if (!user) return;
    try {
      const data = await db.entities.Roll.filter(
        { created_by_id: user.id },
        '-created_date', 500
      );
      setRolls(data || []);
    } catch { /* empty */ }
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchRolls(); }, [fetchRolls]);

  const totalEP = rolls.reduce((s, r) => s + (r.ep || 0), 0);
  const epSpent = user?.ep_spent || 0;
  const availableEP = totalEP - epSpent;
  const activeBoost = user?.active_boost || '';
  const storeUnlocks = user?.store_unlocks || [];

  const handlePurchase = async (item) => {
    setError('');

    if (item.type === 'permanent' && storeUnlocks.includes(item.id)) {
      setError('You already own this item.');
      return;
    }
    if (item.type === 'consumable' && activeBoost) {
      setError('You already have an active boost. Use it on your next roll first!');
      return;
    }
    if (availableEP < item.price) {
      setError(`Not enough EP. You need ${formatEP(item.price)} but have ${formatEP(availableEP)}.`);
      return;
    }

    setPurchasing(item.id);
    try {
      const updates = { ep_spent: epSpent + item.price };
      if (item.type === 'consumable') {
        updates.active_boost = item.id;
      } else {
        updates.store_unlocks = [...storeUnlocks, item.id];
      }
      await db.auth.updateMe(updates);
      await checkUserAuth();
      await fetchRolls();
    } catch {
      setError('Purchase failed. Please try again.');
    }
    setPurchasing(null);
  };

  if (!isAuthenticated) {
    return (
      <div className="mx-auto max-w-md px-4 py-20 text-center">
        <ShoppingBag className="mx-auto mb-4 h-12 w-12 text-zinc-600" />
        <h1 className="mb-2 text-xl font-bold">Sign In Required</h1>
        <p className="text-sm text-zinc-500">Create an account and roll some numbers to start earning EP for the shop.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-zinc-800 border-t-violet-500" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <div className="mb-6 flex items-center gap-3">
        <ShoppingBag className="h-6 w-6 text-violet-400" />
        <h1 className="text-2xl font-bold">EP Shop</h1>
      </div>

      {/* EP Balance */}
      <div className="mb-8 rounded-2xl border border-zinc-800 bg-gradient-to-br from-violet-950/40 to-fuchsia-950/30 p-5">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs uppercase tracking-wider text-zinc-500">Available EP</div>
            <div className="text-3xl font-black text-violet-300">{formatEP(availableEP)}</div>
          </div>
          <div className="text-right">
            <div className="text-xs text-zinc-500">Total Earned</div>
            <div className="text-sm font-semibold text-zinc-400">{formatEP(totalEP)}</div>
            <div className="text-xs text-zinc-500">Spent: {formatEP(epSpent)}</div>
          </div>
        </div>
        {activeBoost && (
          <div className="mt-3 flex items-center gap-2 rounded-lg border border-amber-700/50 bg-amber-950/30 px-3 py-2">
            <Zap className="h-4 w-4 text-amber-400" />
            <span className="text-xs font-semibold text-amber-300">
              Active: {SHOP_ITEMS.find(i => i.id === activeBoost)?.name || activeBoost} — applies on your next roll
            </span>
          </div>
        )}
      </div>

      {error && (
        <div className="mb-6 rounded-xl border border-red-800 bg-red-950/40 p-3 text-sm text-red-300">
          {error}
        </div>
      )}

      {/* Items */}
      <div className="grid gap-4 sm:grid-cols-2">
        {SHOP_ITEMS.map((item) => {
          const owned = item.type === 'permanent' && storeUnlocks.includes(item.id);
          const isActive = activeBoost === item.id;
          const canAfford = availableEP >= item.price;
          const isLoading = purchasing === item.id;

          return (
            <div
              key={item.id}
              className={`relative flex flex-col rounded-2xl border p-5 transition ${
                owned || isActive
                  ? 'border-emerald-700/50 bg-emerald-950/20'
                  : 'border-zinc-800 bg-zinc-900/40 hover:border-zinc-700'
              }`}
            >
              <div className="mb-3 flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500/20 to-fuchsia-600/20 text-2xl">
                    {item.emoji}
                  </div>
                  <div>
                    <h3 className="font-bold">{item.name}</h3>
                    <span className="text-[10px] uppercase tracking-wide text-zinc-500">
                      {item.type === 'consumable' ? 'One-time use' : 'Permanent'}
                    </span>
                  </div>
                </div>
                {owned && <Check className="h-5 w-5 text-emerald-400" />}
                {isActive && <Zap className="h-5 w-5 text-amber-400" />}
              </div>

              <p className="mb-4 text-xs text-zinc-500">{item.desc}</p>

              <div className="mt-auto flex items-center justify-between">
                <div className="text-lg font-bold text-violet-300">{formatEP(item.price)} EP</div>
                <button
                  onClick={() => handlePurchase(item)}
                  disabled={owned || isActive || !canAfford || isLoading}
                  className={`flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-semibold transition ${
                    owned || isActive
                      ? 'cursor-default bg-emerald-950/40 text-emerald-400'
                      : canAfford
                      ? 'bg-gradient-to-r from-violet-500 to-fuchsia-600 text-white hover:opacity-90'
                      : 'cursor-not-allowed bg-zinc-800 text-zinc-600'
                  }`}
                >
                  {isLoading ? (
                    'Processing...'
                  ) : owned ? (
                    <>
                      <Check className="h-3.5 w-3.5" /> Owned
                    </>
                  ) : isActive ? (
                    <>
                      <Zap className="h-3.5 w-3.5" /> Active
                    </>
                  ) : canAfford ? (
                    'Purchase'
                  ) : (
                    <>
                      <Lock className="h-3.5 w-3.5" /> Locked
                    </>
                  )}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}