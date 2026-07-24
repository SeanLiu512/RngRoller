import { db } from '@/api/client';

import { useState, useEffect } from 'react';

import { useAuth } from '@/lib/AuthContext';
import { getRarityStyle, formatEP, getBadgeById, getRarityInfo } from '@/lib/rollEngine';
import RollDisplay from '@/components/RollDisplay';
import EquippedBadge from '@/components/EquippedBadge';
import BadgeEquipSection from '@/components/BadgeEquipSection';
import CustomBadgeCreator from '@/components/CustomBadgeCreator';
import { User, Trophy, Award, Calendar, Sparkles, Flame } from 'lucide-react';

export default function Profile() {
  const { user, checkUserAuth } = useAuth();
  const [rolls, setRolls] = useState([]);
  const [loading, setLoading] = useState(true);
  const [equipping, setEquipping] = useState(false);

  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const data = await db.entities.Roll.filter(
          { created_by_id: user.id },
          '-created_date', 100
        );
        setRolls(data || []);
      } catch { /* empty */ }
      setLoading(false);
    })();
  }, [user]);

  if (!user) return null;

  const totalEP = rolls.reduce((s, r) => s + (r.ep || 0), 0);
  const allBadges = [...new Set(rolls.flatMap(r => r.badges || []))];
  const bestRoll = rolls.reduce((best, r) => (!best || r.ep > best.ep) ? r : best, null);
  const streak = (() => {
    const dates = [...new Set(rolls.map(r => r.roll_date).filter(Boolean))].sort().reverse();
    if (dates.length === 0) return 0;
    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    if (dates[0] !== today && dates[0] !== yesterday) return 0;
    let count = 1;
    for (let i = 1; i < dates.length; i++) {
      const diff = Math.round((new Date(dates[i - 1] + 'T00:00:00') - new Date(dates[i] + 'T00:00:00')) / 86400000);
      if (diff === 1) count++; else break;
    }
    return count;
  })();
  const hasRainbow = rolls.some(r => r.rarity === 'rainbow' || r.rarity === '67_iii') || (user.store_unlocks || []).includes('custom_badge');
  const displayName = user.full_name || user.email?.split('@')[0] || 'Player';

  const equippedBadge = user.equipped_badge || '';
  const customName = user.custom_badge_name || '';
  const customImage = user.custom_badge_image || '';
  const isCustomEquipped = equippedBadge === 'custom';

  const handleEquip = async (badgeId) => {
    setEquipping(true);
    try {
      const newBadge = equippedBadge === badgeId ? '' : badgeId;
      await db.auth.updateMe({ equipped_badge: newBadge });
      await checkUserAuth();
    } catch { /* ignore */ }
    setEquipping(false);
  };

  const handleEquipCustom = async () => {
    setEquipping(true);
    try {
      const newBadge = isCustomEquipped ? '' : 'custom';
      await db.auth.updateMe({ equipped_badge: newBadge });
      await checkUserAuth();
    } catch { /* ignore */ }
    setEquipping(false);
  };

  const handleSaveCustom = async (name, image) => {
    await db.auth.updateMe({
      custom_badge_name: name,
      custom_badge_image: image,
    });
    await checkUserAuth();
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-zinc-800 border-t-violet-500" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      {/* Header */}
      <div className="mb-8 flex items-center gap-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-600 shadow-lg shadow-violet-500/30">
          <User className="h-8 w-8 text-white" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold">{displayName}</h1>
            <EquippedBadge
              badgeId={equippedBadge}
              customName={customName}
              customImage={customImage}
            />
          </div>
          <p className="text-sm text-zinc-500">{user.email}</p>
        </div>
      </div>

      {/* Daily Streak */}
      <div className={`mb-6 flex items-center gap-4 rounded-2xl border p-4 ${
        streak > 0
          ? 'border-orange-700/60 bg-gradient-to-r from-orange-950/40 to-red-950/30'
          : 'border-zinc-800 bg-zinc-900/40'
      }`}>
        <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${
          streak > 0 ? 'bg-orange-500/20' : 'bg-zinc-800'
        }`}>
          <Flame className={`h-6 w-6 ${streak > 0 ? 'text-orange-400' : 'text-zinc-600'}`} />
        </div>
        <div>
          <div className="flex items-baseline gap-1.5">
            <span className={`text-2xl font-black ${streak > 0 ? 'text-orange-400' : 'text-zinc-400'}`}>
              {streak}
            </span>
            <span className="text-sm font-medium text-zinc-500">
              day{streak !== 1 ? 's' : ''} streak
            </span>
          </div>
          <p className="text-xs text-zinc-500">
            {streak === 0
              ? 'Roll today to start your streak!'
              : streak === 1
              ? 'Roll again tomorrow to keep it going!'
              : 'Keep it up! Roll tomorrow to extend your streak.'}
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="mb-8 grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-3 text-center">
          <Trophy className="mx-auto mb-1 h-4 w-4 text-amber-400" />
          <div className="text-lg font-bold text-zinc-200">{formatEP(totalEP)}</div>
          <div className="text-xs text-zinc-500">Total EP</div>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-3 text-center">
          <Calendar className="mx-auto mb-1 h-4 w-4 text-zinc-500" />
          <div className="text-lg font-bold text-zinc-200">{rolls.length}</div>
          <div className="text-xs text-zinc-500">Rolls</div>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-3 text-center">
          <Award className="mx-auto mb-1 h-4 w-4 text-purple-400" />
          <div className="text-lg font-bold text-zinc-200">{allBadges.length}</div>
          <div className="text-xs text-zinc-500">Badges</div>
        </div>
      </div>

      {/* Best roll */}
      {bestRoll && (
        <div className="mb-8">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-zinc-500">Best Roll</h2>
          <RollDisplay roll={bestRoll} />
        </div>
      )}

      {/* Custom badge creator (Rainbow only) */}
      {hasRainbow && (
        <div className="mb-8">
          <CustomBadgeCreator
            customName={customName}
            customImage={customImage}
            onSave={handleSaveCustom}
            onEquipCustom={handleEquipCustom}
            isCustomEquipped={isCustomEquipped}
          />
        </div>
      )}

      {/* Badge collection with equip */}
      <div className="mb-8">
        <div className="mb-3 flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-zinc-500" />
          <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-500">Badge Collection — Click to Equip</h2>
        </div>
        <BadgeEquipSection
          earnedBadges={allBadges}
          equippedBadge={equippedBadge}
          onEquip={handleEquip}
          disabled={equipping}
        />
      </div>

      {/* Roll history */}
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-zinc-500">Roll History</h2>
      {rolls.length === 0 ? (
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/30 py-12 text-center text-sm text-zinc-600">
          No rolls yet. Go roll your first number!
        </div>
      ) : (
        <div className="space-y-2">
          {rolls.map(r => {
            const style = getRarityStyle(r.rarity);
            const info = getRarityInfo(r.rarity);
            return (
              <div key={r.id} className={`flex items-center justify-between rounded-xl border ${style.border} bg-zinc-900/40 px-4 py-3`}>
                <div>
                  <div className={`text-lg font-bold tabular-nums ${style.text}`}>
                    {r.number?.toLocaleString('en-US')}
                  </div>
                  <div className="text-xs text-zinc-500">
                    {info.name} · {r.badges?.length || 0} badges · {r.roll_date}
                  </div>
                </div>
                <div className={`text-sm font-bold ${style.text}`}>{formatEP(r.ep)}</div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}