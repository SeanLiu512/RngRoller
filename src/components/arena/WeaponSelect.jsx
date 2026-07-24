import { useState } from 'react';
import { WEAPONS } from '@/lib/arenaConfig';
import { ChevronRight, Swords } from 'lucide-react';

export default function WeaponSelect({ onSelect, badgeCount }) {
  const [selected, setSelected] = useState(null);

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="mb-6 text-center">
        <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-violet-700/50 bg-violet-950/30 px-4 py-1.5">
          <Swords className="h-4 w-4 text-violet-400" />
          <span className="text-sm font-semibold text-violet-300">ARENA — BADGE BRAWL</span>
        </div>
        <h1 className="text-3xl font-black text-zinc-100">Choose Your Weapon</h1>
        <p className="mt-2 text-sm text-zinc-500">
          Free-for-all arena — drop in mid-fight. Your earned badges ({badgeCount} loaded) become passive powers.
          {badgeCount === 0 && ' Roll some numbers first to power up!'}
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {WEAPONS.map(w => (
          <button
            key={w.id}
            onClick={() => setSelected(w.id)}
            className={`group relative overflow-hidden rounded-2xl border-2 p-5 text-left transition-all ${
              selected === w.id
                ? 'border-violet-500 bg-violet-950/40 shadow-lg shadow-violet-500/20'
                : 'border-zinc-800 bg-zinc-900/40 hover:border-zinc-700'
            }`}
          >
            <div className="flex items-start gap-4">
              <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-xl text-3xl ${
                selected === w.id ? 'bg-violet-500/20' : 'bg-zinc-800'
              }`}>
                {w.emoji}
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-base font-bold text-zinc-100">{w.name}</h3>
                <p className="mt-1 text-xs text-zinc-500">{w.desc}</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <span className="rounded bg-zinc-800 px-2 py-0.5 text-[10px] font-medium text-zinc-400">
                    DMG {w.damage}
                  </span>
                  <span className="rounded bg-zinc-800 px-2 py-0.5 text-[10px] font-medium text-zinc-400">
                    RNG {w.range}
                  </span>
                  <span className="rounded bg-zinc-800 px-2 py-0.5 text-[10px] font-medium text-zinc-400">
                    CD {Math.round(w.cooldown / 100) / 10}s
                  </span>
                </div>
              </div>
            </div>
            {selected === w.id && (
              <div className="absolute right-3 top-3">
                <ChevronRight className="h-5 w-5 text-violet-400" />
              </div>
            )}
          </button>
        ))}
      </div>

      <button
        disabled={!selected}
        onClick={() => onSelect(WEAPONS.find(w => w.id === selected))}
        className={`mt-6 w-full rounded-xl py-3.5 text-base font-bold transition-all ${
          selected
            ? 'bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white hover:from-violet-500 hover:to-fuchsia-500 active:scale-[0.98]'
            : 'cursor-not-allowed bg-zinc-800 text-zinc-600'
        }`}
      >
        {selected ? 'JOIN THE FIGHT ⚔️' : 'SELECT A WEAPON'}
      </button>
    </div>
  );
}