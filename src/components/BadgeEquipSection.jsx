import { getBadgeById, getRarityStyle } from '@/lib/rollEngine';
import { Check } from 'lucide-react';

// Shows all earned badges with equip/unequip buttons.
export default function BadgeEquipSection({ earnedBadges, equippedBadge, onEquip, disabled }) {
  if (earnedBadges.length === 0) {
    return (
      <p className="text-sm text-zinc-600">No badges earned yet. Roll to collect some!</p>
    );
  }

  const sorted = [...earnedBadges].sort((a, b) => {
    const order = { rainbow: 0, mythic: 1, anomaly: 2, epic: 3, rare: 4, uncommon: 5, common: 6 };
    return order[a.rarity] - order[b.rarity];
  });

  return (
    <div className="flex flex-wrap gap-2">
      {sorted.map(badgeId => {
        const badge = getBadgeById(badgeId);
        if (!badge) return null;
        const style = getRarityStyle(badge.rarity);
        const isEquipped = equippedBadge === badgeId;
        return (
          <button
            key={badgeId}
            onClick={() => onEquip(badgeId)}
            disabled={disabled}
            className={`group flex items-center gap-2 rounded-xl border px-3 py-2 transition ${
              isEquipped
                ? `${style.border} ${style.bg} ring-2 ring-violet-500`
                : `${style.border} ${style.bg} hover:ring-1 hover:ring-violet-500/50`
            }`}
          >
            <span className="text-lg">{badge.emoji}</span>
            <div className="flex flex-col text-left">
              <span className={`text-xs font-semibold ${style.text}`}>{badge.name}</span>
              <span className="text-[10px] uppercase tracking-wide text-zinc-500">
                {isEquipped ? '✓ Equipped' : 'Click to equip'}
              </span>
            </div>
            {isEquipped && <Check className="h-3.5 w-3.5 text-violet-400" />}
          </button>
        );
      })}
    </div>
  );
}