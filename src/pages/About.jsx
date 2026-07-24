import { BADGES, RARITY_TIERS, getRarityStyle } from '@/lib/rollEngine';
import { Dices, Search, Award, Users, Sparkles, Zap } from 'lucide-react';

const BADGE_RARITY_INFO = [
  { name: 'Common',   desc: '> 10% of rolls',        color: 'text-zinc-300',    bg: 'bg-zinc-900/40',    border: 'border-zinc-700',    hex: '#9ca3af' },
  { name: 'Uncommon', desc: '1–10% of rolls',        color: 'text-emerald-400', bg: 'bg-emerald-950/30', border: 'border-emerald-700', hex: '#2ecc71' },
  { name: 'Rare',     desc: '0.1–1% of rolls',       color: 'text-blue-400',    bg: 'bg-blue-950/30',    border: 'border-blue-700',    hex: '#3498db' },
  { name: 'Epic',     desc: '0.01–0.1% of rolls',   color: 'text-purple-400',  bg: 'bg-purple-950/30',  border: 'border-purple-700',  hex: '#9b59b6' },
  { name: 'Anomaly',  desc: '0.001–0.01% of rolls', color: 'text-orange-400',  bg: 'bg-orange-950/30',  border: 'border-orange-700',  hex: '#e67e22' },
  { name: 'Mythic',   desc: '< 0.001% (1 in 100k+)', color: 'text-red-400',     bg: 'bg-red-950/30',     border: 'border-red-700',     hex: '#e74c3c' },
  { name: 'Rainbow',  desc: 'Nearly impossible — custom badge unlock', color: 'bg-gradient-to-r from-red-400 via-yellow-400 via-green-400 via-blue-400 to-purple-400 bg-clip-text text-transparent', bg: 'bg-gradient-to-br from-red-950/20 via-yellow-950/10 via-green-950/10 via-blue-950/10 to-purple-950/20', border: 'border-pink-500/50', hex: '#ff00ff' },
];

export default function About() {
  const sortedBadges = [...BADGES].sort((a, b) => {
    const order = { rainbow: 0, mythic: 1, anomaly: 2, epic: 3, rare: 4, uncommon: 5, common: 6 };
    return order[a.rarity] - order[b.rarity];
  });

  return (
    <div className="relative mx-auto max-w-4xl px-4 py-10">
      {/* Ambient glow */}
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute left-1/4 top-0 h-[30rem] w-[30rem] rounded-full bg-violet-600/10 blur-[120px]" />
        <div className="absolute right-1/4 bottom-0 h-[30rem] w-[30rem] rounded-full bg-fuchsia-600/10 blur-[120px]" />
      </div>

      {/* Hero */}
      <div className="mb-10 text-center">
        <h1 className="mb-3 text-4xl font-black tracking-tight sm:text-5xl">
          <span className="bg-gradient-to-r from-violet-400 via-fuchsia-400 to-violet-400 bg-clip-text text-transparent">
            What is Rollr?
          </span>
        </h1>
        <p className="mx-auto max-w-2xl text-zinc-400">
          Rollr is a random number game. Roll to generate a number from 0 to 999,999.
          Your number is analyzed for interesting patterns, earning you badges and EP (entropy points).
        </p>
      </div>

      {/* How it works */}
      <div className="mb-12 grid gap-4 sm:grid-cols-3">
        {[
          { icon: Dices, title: 'Roll', desc: 'Press the button to generate a random number', color: 'text-violet-400' },
          { icon: Search, title: 'Discover', desc: 'See what badges your number earns', color: 'text-blue-400' },
          { icon: Award, title: 'Collect', desc: 'Build your badge collection over time', color: 'text-amber-400' },
        ].map(({ icon: Icon, title, desc, color }) => (
          <div key={title} className="group rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5 transition hover:border-zinc-700 hover:bg-zinc-900/60">
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-800 transition group-hover:scale-110">
              <Icon className={`h-5 w-5 ${color}`} />
            </div>
            <h3 className="mb-1 font-bold">{title}</h3>
            <p className="text-sm text-zinc-500">{desc}</p>
          </div>
        ))}
      </div>

      {/* Probability Tiers */}
      <div className="mb-12">
        <div className="mb-4 flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-violet-400" />
          <h2 className="text-xl font-bold">Probability Tiers</h2>
        </div>
        <p className="mb-4 text-sm text-zinc-500">
          Your roll's rarity is based on total EP compared to all possible rolls.
        </p>
        <div className="space-y-1.5">
          {RARITY_TIERS.map(tier => {
            const style = getRarityStyle(tier.id);
            return (
              <div key={tier.id} className={`group flex items-center justify-between rounded-xl border ${style.border} ${style.bg} px-4 py-3 transition hover:scale-[1.02]`}>
                <div className="flex items-center gap-3">
                  <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: style.hex }} />
                  <span className={`font-bold uppercase tracking-wide ${style.text}`}>{tier.name}</span>
                </div>
                <span className="text-sm font-medium text-zinc-400">{tier.desc}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Badge Rarity */}
      <div className="mb-12">
        <div className="mb-4 flex items-center gap-2">
          <Zap className="h-5 w-5 text-amber-400" />
          <h2 className="text-xl font-bold">Badge Rarity</h2>
        </div>
        <p className="mb-4 text-sm text-zinc-500">
          Each badge has a rarity based on how likely it is to appear. Rarer badges are worth more EP.
          Badge rarity is defined by probability:
        </p>
        <div className="space-y-1.5">
          {BADGE_RARITY_INFO.map(r => (
            <div key={r.name} className={`group flex items-center justify-between rounded-xl border ${r.border} ${r.bg} px-4 py-3 transition hover:scale-[1.02]`}>
              <div className="flex items-center gap-3">
                <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: r.hex }} />
                <span className={`font-bold uppercase tracking-wide ${r.color}`}>{r.name}</span>
              </div>
              <span className="text-sm font-medium text-zinc-400">{r.desc}</span>
            </div>
          ))}
        </div>
      </div>

      {/* All Badges */}
      <div className="mb-8">
        <div className="mb-4 flex items-center gap-2">
          <Award className="h-5 w-5 text-violet-400" />
          <h2 className="text-xl font-bold">All Badges ({BADGES.length})</h2>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          {sortedBadges.map(b => {
            const style = getRarityStyle(b.rarity);
            return (
              <div key={b.id} className={`group flex items-center gap-3 rounded-xl border ${style.border} bg-zinc-900/40 px-3 py-2.5 transition hover:scale-[1.02] hover:bg-zinc-900/60`}>
                <span className="text-xl transition group-hover:scale-110">{b.emoji}</span>
                <div className="flex-1">
                  <div className={`text-sm font-semibold ${style.text}`}>{b.name}</div>
                  <div className="text-xs text-zinc-500">{b.desc}</div>
                </div>
                <span className="text-[10px] uppercase tracking-wide text-zinc-600">{b.rarity}</span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex items-center gap-2 rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4 text-sm text-zinc-500">
        <Users className="h-4 w-4 shrink-0" />
        Built for classmates — roll daily, compare numbers, and collect them all.
      </div>
    </div>
  );
}