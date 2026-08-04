import { db } from '@/api/client';

import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';

import { getRarityStyle, formatEP } from '@/lib/rollEngine';
import EquippedBadge from '@/components/EquippedBadge';
import { Trophy, Medal } from 'lucide-react';

const todayStr = () => new Date().toISOString().split('T')[0];
const weekAgoStr = () => {
  const d = new Date();
  d.setDate(d.getDate() - 7);
  return d.toISOString().split('T')[0];
};

const RANK_STYLES = {
  1: 'text-amber-400',
  2: 'text-zinc-300',
  3: 'text-orange-400',
};

export default function Leaderboard() {
  const [tab, setTab] = useState('today');
  const [rolls, setRolls] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchRolls = useCallback(async () => {
    setLoading(true);
    try {
      let data;
      if (tab === 'today') {
        data = await db.entities.Roll.filter({ roll_date: todayStr() }, '-ep', 50);
      } else if (tab === 'week') {
        data = await db.entities.Roll.filter({ roll_date: { $gte: weekAgoStr() } }, '-ep', 50);
      } else {
        data = await db.entities.Roll.list('-ep', 50);
      }
      setRolls(data || []);
    } catch {
      setRolls([]);
    } finally {
      setLoading(false);
    }
  }, [tab]);

  useEffect(() => { fetchRolls(); }, [fetchRolls]);

  const tabs = [
    { id: 'today', label: 'Today' },
    { id: 'week', label: 'This Week' },
    { id: 'all', label: 'All-Time' },
  ];

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <div className="mb-6 flex items-center gap-3">
        <Trophy className="h-6 w-6 text-amber-400" />
        <h1 className="text-2xl font-bold">Leaderboard</h1>
      </div>

      {/* Tabs */}
      <div className="mb-6 flex gap-1 rounded-xl border border-zinc-800 bg-zinc-900/50 p-1">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 rounded-lg px-4 py-2 text-sm font-semibold transition ${
              tab === t.id ? 'bg-gradient-to-r from-violet-500 to-fuchsia-600 text-white' : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* List */}
      {loading ? (
        <div className="flex justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-zinc-800 border-t-violet-500" />
        </div>
      ) : rolls.length === 0 ? (
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/30 py-20 text-center">
          <p className="text-zinc-500">No rolls yet for this period.</p>
          <Link to="/" className="mt-3 inline-block text-sm font-semibold text-violet-400 hover:underline">
            Be the first to roll!
          </Link>
        </div>
      ) : (
        <div className="space-y-2">
          {rolls.map((r, i) => {
            const rank = i + 1;
            const style = getRarityStyle(r.rarity);
            return (
              <div
                key={r.id}
                className={`flex items-center gap-3 rounded-xl border ${style.border} bg-zinc-900/40 px-4 py-3`}
              >
                {/* Rank */}
                <div className="flex w-8 items-center justify-center">
                  {rank <= 3 ? (
                    <Medal className={`h-5 w-5 ${RANK_STYLES[rank]}`} />
                  ) : (
                    <span className="text-sm font-bold text-zinc-500">#{rank}</span>
                  )}
                </div>

                {/* Player + number */}
                <div className="flex-1">
                  <div className={`text-lg font-bold tabular-nums ${style.text}`}>
                    {r.number?.toLocaleString('en-US')}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-zinc-500">{r.roller_name || 'Unknown'}</span>
                    {r.roller_vip && <span className="text-xs font-bold text-amber-400">⭐ VIP</span>}
                    <EquippedBadge
                      badgeId={r.equipped_badge}
                      customName={r.custom_badge_name}
                      customImage={r.custom_badge_image}
                    />
                  </div>
                </div>

                {/* Badges count */}
                <div className="hidden text-right sm:block">
                  <div className="text-xs text-zinc-500">{r.badges?.length || 0} badges</div>
                </div>

                {/* EP */}
                <div className="text-right">
                  <div className={`text-sm font-bold ${style.text}`}>{formatEP(r.ep)}</div>
                  <div className="text-[10px] uppercase text-zinc-600">EP</div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}