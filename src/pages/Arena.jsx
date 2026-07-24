import { db } from '@/api/client';

import { useState, useEffect, useCallback } from 'react';

import { useAuth } from '@/lib/AuthContext';
import WeaponSelect from '@/components/arena/WeaponSelect';
import ArenaGame from '@/components/arena/ArenaGame';
import { getBadgeEffects } from '@/lib/arenaConfig';
import { getBadgeById, getRarityStyle, getRarityRank } from '@/lib/rollEngine';
import { Swords, Sparkles, Zap } from 'lucide-react';

export default function Arena() {
  const { user, isAuthenticated } = useAuth();
  const [phase, setPhase] = useState('select'); // select | playing
  const [weapon, setWeapon] = useState(null);
  const [badgeIds, setBadgeIds] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchBadges = useCallback(async () => {
    if (!isAuthenticated) {
      setLoading(false);
      return;
    }
    try {
      const rolls = await db.entities.Roll.list('-created_date', 200);
      const uniqueBadges = new Set();
      for (const r of rolls) {
        if (r.badges) r.badges.forEach(b => uniqueBadges.add(b));
      }
      setBadgeIds([...uniqueBadges]);
    } catch {
      setBadgeIds([]);
    }
    setLoading(false);
  }, [isAuthenticated]);

  useEffect(() => {
    fetchBadges();
  }, [fetchBadges]);

  const handleLeave = (sessionData) => {
    // Save session stats to entity
    if (isAuthenticated && sessionData && (sessionData.kills > 0 || sessionData.deaths > 0)) {
      db.entities.ArenaMatch.create({
        player_name: user?.full_name || user?.email?.split('@')[0] || 'Player',
        weapon_id: weapon.id,
        badges_used: badgeIds,
        result: sessionData.kills > sessionData.deaths ? 'victory' : 'defeat',
        kills: sessionData.kills || 0,
        damage_dealt: 0,
        damage_taken: 0,
        survival_time: sessionData.time || 0,
        rank: 0,
      }).catch(() => {});
    }
    setPhase('select');
    setWeapon(null);
  };

  if (!isAuthenticated) {
    return (
      <div className="mx-auto max-w-md px-4 py-20 text-center">
        <Swords className="mx-auto mb-4 h-12 w-12 text-violet-500" />
        <h1 className="mb-2 text-xl font-bold">Sign In Required</h1>
        <p className="text-sm text-zinc-500">Log in to enter the arena and use your badges in battle.</p>
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

  if (phase === 'select') {
    const effects = getBadgeEffects(badgeIds);
    return (
      <div>
        <WeaponSelect
          badgeCount={badgeIds.length}
          onSelect={(w) => { setWeapon(w); setPhase('playing'); }}
        />
        {effects.length > 0 && (
          <div className="mx-auto max-w-3xl px-4 pb-10">
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5">
              <div className="mb-3 flex items-center gap-2">
                <Zap className="h-4 w-4 text-violet-400" />
                <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-400">
                  Active Badge Powers ({effects.length})
                </h2>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {effects.sort((a, b) => {
                  const ba = getBadgeById(a.badgeId);
                  const bb = getBadgeById(b.badgeId);
                  return getRarityRank(bb?.rarity) - getRarityRank(ba?.rarity);
                }).map(eff => {
                  const badge = getBadgeById(eff.badgeId);
                  const style = badge ? getRarityStyle(badge.rarity) : getRarityStyle('common');
                  return (
                    <div key={eff.badgeId} className={`flex items-start gap-2 rounded-xl border ${style.border} ${style.bg} px-3 py-2`}>
                      <span className="text-lg">{badge?.emoji || '✨'}</span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className={`text-xs font-bold ${style.text}`}>{eff.name}</span>
                          {eff.quirky && <Sparkles className="h-3 w-3 text-fuchsia-400" />}
                        </div>
                        <p className="text-[11px] text-zinc-500">{eff.desc}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
              <p className="mt-3 text-center text-[11px] text-zinc-600">
                <Sparkles className="mr-1 inline h-3 w-3 text-fuchsia-400" />
                Quirky badges have unexpected effects. Roll more numbers to unlock new powers!
              </p>
            </div>
          </div>
        )}
      </div>
    );
  }

  if (phase === 'playing' && weapon) {
    return (
      <ArenaGame
        weapon={weapon}
        badgeIds={badgeIds}
        playerBadgeIds={badgeIds}
        onLeave={handleLeave}
      />
    );
  }

  return null;
}