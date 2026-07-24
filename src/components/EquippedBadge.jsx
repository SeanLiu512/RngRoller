import { getBadgeById, getRarityStyle } from '@/lib/rollEngine';

// Displays a small equipped badge chip next to a username.
// Supports both built-in badges and custom badges.
export default function EquippedBadge({ badgeId, customName, customImage }) {
  if (!badgeId) return null;

  // Custom badge
  if (badgeId === 'custom') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-pink-500/50 bg-gradient-to-r from-red-950/40 via-yellow-950/40 via-green-950/40 via-blue-950/40 to-purple-950/40 px-2 py-0.5">
        {customImage ? (
          <img src={customImage} alt="" className="h-4 w-4 rounded-full object-cover" />
        ) : (
          <span className="text-xs">✨</span>
        )}
        <span className="bg-gradient-to-r from-red-400 via-yellow-400 via-green-400 via-blue-400 to-purple-400 bg-clip-text text-xs font-semibold text-transparent">
          {customName || 'Custom'}
        </span>
      </span>
    );
  }

  // Built-in badge
  const badge = getBadgeById(badgeId);
  if (!badge) return null;
  const style = getRarityStyle(badge.rarity);

  return (
    <span className={`inline-flex items-center gap-1 rounded-full border ${style.border} ${style.bg} px-2 py-0.5`}>
      <span className="text-xs">{badge.emoji}</span>
      <span className={`text-xs font-semibold ${style.text}`}>{badge.name}</span>
    </span>
  );
}