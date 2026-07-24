import BadgeChip from './BadgeChip';
import { getRarityInfo, getRarityStyle, getRarityRank, formatEP } from '@/lib/rollEngine';

export default function RollDisplay({ roll, animate = false }) {
  if (!roll) return null;
  const rarity = getRarityInfo(roll.rarity);
  const style = getRarityStyle(roll.rarity);
  const isRainbowTier = roll.rarity === 'rainbow' || roll.rarity === '67_iii';
  const isHighTier = getRarityRank(roll.rarity) >= getRarityRank('rare');
  const isEpicPlus = getRarityRank(roll.rarity) >= getRarityRank('epic');

  return (
    <div className={`relative overflow-hidden rounded-3xl border-2 ${style.border} ${style.bg} p-6 shadow-2xl ${style.glow} ${animate ? 'animate-in fade-in zoom-in-95 duration-500' : ''}`}>
      {/* outer glow ring */}
      <div className={`pointer-events-none absolute -inset-1 rounded-3xl bg-gradient-to-br ${style.gradient} opacity-20 blur-lg`} />
      {/* glow background */}
      <div className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${style.gradient} opacity-[0.15]`} />
      {/* radial glow behind number */}
      <div className={`pointer-events-none absolute left-1/2 top-1/2 h-56 w-56 -translate-x-1/2 -translate-y-1/2 rounded-full bg-gradient-to-br ${style.gradient} opacity-25 blur-[50px] ${isHighTier ? 'animate-pulse' : ''}`} />
      {/* animated shimmer for epic+ tiers */}
      {(isRainbowTier || isEpicPlus) && (
        <div className={`pointer-events-none absolute inset-0 bg-[length:200%_100%] animate-[shimmer_3s_linear_infinite] bg-gradient-to-r from-transparent via-white/20 to-transparent ${isRainbowTier ? 'opacity-30' : 'opacity-15'}`} />
      )}

      <div className="relative">
        {/* Rarity label */}
        <div className="mb-4 flex items-center justify-center">
          <span className={`rounded-full border ${style.border} ${style.bg} px-4 py-1 text-xs font-bold uppercase tracking-widest ${style.text} ${isHighTier ? 'animate-pulse' : ''}`}>
            {rarity.name} · {rarity.desc}
          </span>
        </div>

        {/* The number */}
        <div className="mb-2 text-center">
          <div
            style={isHighTier ? { filter: `drop-shadow(0 0 15px ${style.hex})` } : undefined}
            className={`text-5xl font-black tabular-nums tracking-tight sm:text-7xl ${style.text} ${animate ? 'animate-in fade-in slide-in-from-bottom-3 duration-700' : ''}`}
          >
            {roll.number.toLocaleString('en-US')}
          </div>
        </div>

        {/* EP */}
        <div className="mb-6 text-center">
          <span className="text-sm text-zinc-500">
            <span className={`font-bold ${style.text}`}>{formatEP(roll.ep)}</span> EP
          </span>
        </div>

        {/* Badges */}
        {roll.badges && roll.badges.length > 0 && (
          <div>
            <p className="mb-2 text-center text-xs font-semibold uppercase tracking-wider text-zinc-500">
              {roll.badges.length} Badge{roll.badges.length > 1 ? 's' : ''} Earned
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              {roll.badges.map((b, i) => (
                <div
                  key={b}
                  style={animate ? { animationDelay: `${i * 100}ms` } : {}}
                  className={animate ? 'animate-in fade-in slide-in-from-bottom-2 duration-500' : ''}
                >
                  <BadgeChip badgeId={b} />
                </div>
              ))}
            </div>
          </div>
        )}

        {roll.badges && roll.badges.length === 0 && (
          <p className="text-center text-sm text-zinc-600">No badges — just a boring number.</p>
        )}
      </div>
    </div>
  );
}