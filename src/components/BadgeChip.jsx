import { getBadgeById, getRarityStyle } from '@/lib/rollEngine';

export default function BadgeChip({ badgeId }) {
  const badge = getBadgeById(badgeId);
  if (!badge) return null;
  const style = getRarityStyle(badge.rarity);

  return (
    <div
      className={`group relative flex items-center gap-2 rounded-xl border ${style.border} ${style.bg} px-3 py-2 transition hover:scale-105`}
      title={`${badge.name} — ${badge.desc} (${badge.rarity})`}
    >
      <span className="text-lg">{badge.emoji}</span>
      <div className="flex flex-col">
        <span className={`text-xs font-semibold ${style.text}`}>{badge.name}</span>
        <span className="text-[10px] uppercase tracking-wide text-zinc-500">{badge.rarity}</span>
      </div>
    </div>
  );
}