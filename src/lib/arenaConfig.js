// ═══════════════════════════════════════════════
//  ARENA CONFIG — Weapons & Badge Effects
// ═══════════════════════════════════════════════

export const WEAPONS = [
  {
    id: 'sword',
    name: 'Blade of Numbers',
    emoji: '⚔️',
    desc: 'Dash forward and slash. High damage, short range.',
    range: 65,
    damage: 28,
    cooldown: 420,
    speed: 1.0,
    projectile: false,
    arc: 80,
  },
  {
    id: 'bow',
    name: 'Fibonacci Bow',
    emoji: '🏹',
    desc: 'Fire arrows across the arena. Long range, medium damage.',
    range: 380,
    damage: 20,
    cooldown: 580,
    speed: 1.0,
    projectile: true,
    projectileSpeed: 9,
  },
  {
    id: 'staff',
    name: 'Prime Staff',
    emoji: '🔮',
    desc: 'Launch magic orbs that explode on impact. AoE damage.',
    range: 300,
    damage: 24,
    cooldown: 720,
    speed: 1.0,
    projectile: true,
    projectileSpeed: 6,
    aoe: 55,
  },
  {
    id: 'gauntlets',
    name: 'Void Gauntlets',
    emoji: '🥊',
    desc: 'Rapid melee combos. Low damage, very fast attacks.',
    range: 50,
    damage: 11,
    cooldown: 190,
    speed: 1.18,
    projectile: false,
    arc: 70,
  },
  {
    id: 'spear',
    name: 'Infinity Spear',
    emoji: '🔱',
    desc: 'A narrow thrust with extra reach. Precise, punishing melee.',
    range: 100,
    damage: 22,
    cooldown: 500,
    speed: 1.0,
    projectile: false,
    arc: 36,
  },
  {
    id: 'hammer',
    name: 'Fraction Hammer',
    emoji: '🔨',
    desc: 'A slow, devastating swing. Huge damage, wide arc.',
    range: 75,
    damage: 42,
    cooldown: 900,
    speed: 0.9,
    projectile: false,
    arc: 110,
  },
  {
    id: 'crossbow',
    name: "Sniper's Ratio",
    emoji: '🎯',
    desc: 'A single devastating bolt. Extreme range, slow reload.',
    range: 460,
    damage: 34,
    cooldown: 950,
    speed: 1.0,
    projectile: true,
    projectileSpeed: 14,
  },
  {
    id: 'chakram',
    name: 'Chakram of Chaos',
    emoji: '💫',
    desc: 'A fast spinning disc with a small blast on impact.',
    range: 260,
    damage: 16,
    cooldown: 480,
    speed: 1.0,
    projectile: true,
    projectileSpeed: 10,
    aoe: 40,
  },
];

// ── Badge Effects ──
// Each effect can modify stats via `mods` and/or have special `flags`.
// The game engine checks flags to implement unique behaviors.
// `quirky: true` marks the "never thought of" effects.

export const BADGE_EFFECTS = {
  // ── COMMON ──
  divisible_2:      { name: 'Swift Stride',     desc: '+8% move speed',                    mods: { speed: 1.08 } },
  divisible_3:      { name: 'Triple Tap',       desc: '+2 attack damage',                  mods: { damage: 2 } },
  divisible_5:      { name: 'Fiver Frenzy',     desc: '+8% attack speed',                  mods: { attackSpeed: 1.08 } },
  divisible_7:      { name: 'Lucky Seven',      desc: '+6% crit chance',                  mods: { crit: 0.06 } },
  contains_zero:    { name: 'Zero Gravity',      desc: 'Attacks slow enemies by 20%',       flags: ['slowOnHit'] },
  ends_zero:        { name: 'Round Hide',       desc: '+15 max HP',                        mods: { maxHp: 15 } },
  hydrogen:         { name: 'Atomic Base',       desc: '+20 max HP',                        mods: { maxHp: 20 } },
  evil:             { name: 'Corruption',        desc: 'Attacks deal 3% lifesteal',         mods: { lifesteal: 0.03 } },
  deficient:        { name: 'Deficient Guard',  desc: 'Take 6% less damage',               mods: { defense: 0.06 } },

  // ── UNCOMMON ──
  meme_69:          { name: 'Nice Executioner', desc: '+20% damage to enemies below 30% HP', flags: ['execute'] },
  meme_420:         { name: 'Blaze It',          desc: 'Regen 1.5 HP/sec',                  mods: { regen: 1.5 } },
  meme_1337:        { name: 'Leet Hands',       desc: '+14% attack speed',                 mods: { attackSpeed: 1.14 } },
  meme_8008:        { name: 'Bouncy',            desc: '+20 max HP, bounce attacks',        mods: { maxHp: 20 }, flags: ['bounce'] },
  meme_69420:       { name: 'Ultimate Meme',    desc: '+8% to all stats',                  mods: { speed: 1.08, damage: 4, attackSpeed: 1.08, maxHp: 15 } },
  divisible_100:    { name: 'Centurion',        desc: '+30 max HP',                        mods: { maxHp: 30 } },
  three_kind:       { name: 'Triple Shot',       desc: 'Fire 3 projectiles per attack',     flags: ['multishot3'] },
  mirror:           { name: 'Mirror Coat',      desc: 'Reflect 10% of damage taken',       flags: ['reflect10'] },
  boron:            { name: 'Boron Plating',    desc: '+12% defense',                      mods: { defense: 0.12 } },
  carbon:           { name: 'Carbon Edge',      desc: '+12% attack damage',                mods: { damage: 4 } },
  oxygen:           { name: 'Oxygen Tank',      desc: 'Regen 2.5 HP/sec',                  mods: { regen: 2.5 } },
  happy:            { name: 'Happy Shield',     desc: '8% chance to negate incoming damage', flags: ['happyDodge'] },
  harshad:          { name: 'Harshad Speed',    desc: '+12% move speed',                   mods: { speed: 1.12 } },
  abundant:         { name: 'Abundant Vitality',desc: '+40 max HP',                        mods: { maxHp: 40 } },
  pronic:           { name: 'Pronic Jump',       desc: 'Every 3rd attack deals 2x damage',  flags: ['pronicCombo'] },

  // ── RARE ──
  prime:            { name: 'Prime Critical',   desc: 'Crits deal 2.5x damage',            mods: { critDmg: 2.5 } },
  perfect_square:   { name: 'Square Guard',     desc: '+20% defense',                      mods: { defense: 0.20 } },
  palindrome:       { name: 'Palindromic Reversal', desc: 'When hit, attacker takes 25% of damage', flags: ['reflect25'], quirky: true },
  fibonacci:        { name: 'Golden Spiral',    desc: 'Projectiles spiral outward',         flags: ['spiralShot'], quirky: true },
  triple_seven:     { name: 'Jackpot',           desc: '7% chance to instakill on hit',     flags: ['instakill7'] },
  triple_six:       { name: 'Devil\'s Bargain', desc: '+30% damage, -15 max HP',           mods: { damage: 8, maxHp: -15 }, quirky: true },
  repeated_digit:   { name: 'Echo Strike',      desc: 'Every attack hits twice',           flags: ['doubleHit'] },
  gold:             { name: 'Golden Aura',      desc: '+15% to all stats',                 mods: { speed: 1.15, damage: 6, attackSpeed: 1.15, maxHp: 25 } },
  triangular:       { name: 'Triangular Slash', desc: 'Attacks hit in a triangular AoE',   flags: ['triangularAoE'] },
  smith:            { name: 'Smith Armor',      desc: '+22% defense',                      mods: { defense: 0.22 } },
  lucas:            { name: 'Lucas Precision',  desc: '+18% crit chance',                  mods: { crit: 0.18 } },
  hexagonal:        { name: 'Hex Shield',       desc: 'Every 5s, gain a 30 HP shield',     flags: ['hexShield'] },
  echo:             { name: 'Echo Blast',        desc: 'Attacks repeat 1s later at same spot', flags: ['echoBlast'], quirky: true },

  // ── EPIC ──
  perfect_cube:     { name: 'Cubed Crits',      desc: 'Crits deal 3x damage',              mods: { critDmg: 3.0 } },
  contiguous_sixes: { name: 'Inferno Aura',     desc: 'Burn nearby enemies for 4 dmg/s',   flags: ['fireAura'] },
  contiguous_fives: { name: 'Stun Strike',      desc: '15% chance to stun on hit',         flags: ['stunChance'] },
  contiguous_fours: { name: 'Quad Damage',      desc: '25% chance for 4x damage',          flags: ['quadDmg'] },
  counting_up:      { name: 'Ascending Power',  desc: 'Damage +2% every second (caps at +60%)', flags: ['ascending'], quirky: true },
  counting_down:    { name: 'Descending Doom', desc: 'Enemy damage -3% every second',     flags: ['descending'], quirky: true },
  sequential:       { name: 'Chain Lightning', desc: 'Attacks chain to nearby enemies',   flags: ['chainLightning'] },
  uranium:          { name: 'Radiation Leak',   desc: 'Enemies near you take 6 dmg/s DoT', flags: ['radiation'] },
  automorphic:      { name: 'Self-Replicate',   desc: '10% chance projectiles split in two', flags: ['splitShot'] },
  kaprekar:        { name: 'Kaprekar Split',    desc: 'Projectiles split into 2 on impact', flags: ['splitOnImpact'] },

  // ── ANOMALY ──
  binary_soul:      { name: 'Binary Soul',       desc: '40% chance to phase through damage', flags: ['binaryDodge'], quirky: true },
  sixth_power:      { name: 'Sixth Power Surge', desc: 'Every 6th attack deals 6x damage',  flags: ['sixthPower'] },
  fifth_power:      { name: 'Fifth Power Crit',  desc: 'Every 5th attack is a guaranteed crit', flags: ['fifthPower'] },
  all_same:         { name: 'Uniform Barrage',   desc: 'Fire 5 projectiles in a spread',    flags: ['multishot5'] },
  six_nines:        { name: 'Nine Inferno',      desc: '+999% damage (capped at +50%)',     mods: { damage: 15 } },
  deep_void:        { name: 'Void Pull',         desc: 'A black hole pulls enemies toward you', flags: ['voidPull'], quirky: true },

  // ── MYTHIC ──
  one_million:      { name: 'Million Strike',   desc: '+40 attack damage',                 mods: { damage: 40 } },
  the_void:         { name: 'The Void',          desc: 'Instantly kill enemies below 10% HP', flags: ['voidExecute'], quirky: true },
  pi_digits:        { name: 'Pi Multiplier',    desc: 'All damage x3.14',                  flags: ['piMult'] },
  golden_ratio:     { name: 'Golden Form',       desc: '1.618x all stats',                  mods: { speed: 1.618, damage: 6, attackSpeed: 1.3, maxHp: 30, crit: 0.16 } },
  euler:            { name: 'Exponential Growth',desc: 'Damage grows by e (2.718x) over 10s', flags: ['exponential'], quirky: true },

  // ── RAINBOW ──
  perfect_number:   { name: 'Perfection',       desc: 'Immune to damage for 3s, +50 all stats', flags: ['perfectImmune'], mods: { damage: 50, maxHp: 50, speed: 1.3 } },
  munchausen:       { name: 'Circus Master',    desc: 'Summon 2 clone illusions that fight for you', flags: ['summonClones'], quirky: true },
  narcissistic:     { name: 'Narcissistic Aura', desc: 'Enemies that hit you take the same damage', flags: ['narcissist'], quirky: true },

  // ── 67 SERIES ──
  '67_i':           { name: '67% Lifesteal',     desc: 'Heal for 67% of damage dealt',      mods: { lifesteal: 0.67 } },
  '67_ii':          { name: 'Double Everything', desc: '2x damage, 2x HP, 2x speed',       flags: ['doubleAll'] },
  '67_iii':         { name: 'Reality Warp',      desc: 'When enemies attack you, they take the damage instead', flags: ['realityWarp'], quirky: true },

  // ── NEW ADDITIONS ──
  // COMMON
  square_root:      { name: 'Root Focus',       desc: '+7% crit chance, +5% attack speed', mods: { crit: 0.07, attackSpeed: 1.05 } },
  even_digits:      { name: 'Even Footing',     desc: '+10 max HP, +4% move speed',        mods: { maxHp: 10, speed: 1.04 } },
  odd_digits:       { name: "Odd One's Edge",   desc: '+3 attack damage',                  mods: { damage: 3 } },
  // UNCOMMON
  lucky_number:     { name: 'Fourleaf Fortune',  desc: '+10% crit chance, +10% crit damage', mods: { crit: 0.10, critDmg: 0.10 } },
  vampire_number:   { name: 'Vampiric Split',   desc: 'Attacks lifesteal 8%, deal 2 less damage', mods: { lifesteal: 0.08, damage: -2 } },
  half_balance:     { name: 'Balanced Halves',  desc: '+10% attack damage, +10% max HP',   mods: { damage: 3, maxHp: 15 } },
  // RARE
  twin_prime:       { name: 'Twin Strike',      desc: 'Fire 2 projectiles per attack',     flags: ['multishot3'] },
  ricochet:         { name: 'Ricochet Rounds',  desc: 'Projectiles bounce off arena walls', flags: ['bounce'] },
  glass_cannon:      { name: 'Glass Cannon',      desc: '+35% attack damage, -20% defense',  mods: { damage: 10, defense: -0.20 } },
  // EPIC
  fortress:         { name: 'Fortress Stance',  desc: '+30% defense, -10% move speed',     mods: { defense: 0.30, speed: 0.90 } },
  berserker:        { name: "Berserker's Rage", desc: '+18% attack speed, +18% damage, -15% defense', mods: { attackSpeed: 1.18, damage: 5, defense: -0.15 } },
  phoenix:          { name: 'Phoenix Regen',    desc: 'Regen 4 HP/sec, +25 max HP',        mods: { regen: 4, maxHp: 25 } },
  // ANOMALY
  quintuple:        { name: 'Quintuple Threat', desc: 'Fire 5 projectiles in a spread',    flags: ['multishot5'] },
  overclock:        { name: 'Overclocked Core', desc: '+22% attack speed, +22% move speed', mods: { attackSpeed: 1.22, speed: 1.22 } },
};

// Get all badge effects for a list of badge IDs
export function getBadgeEffects(badgeIds = []) {
  return badgeIds
    .map(id => {
      const effect = BADGE_EFFECTS[id];
      if (!effect) return null;
      return { badgeId: id, ...effect };
    })
    .filter(Boolean);
}

// Compute final player stats from base weapon + badge effects
export function computePlayerStats(weapon, effects = []) {
  const base = {
    maxHp: 100,
    speed: 2.2 * (weapon.speed || 1),
    damage: weapon.damage,
    attackSpeed: 1.0,
    crit: 0.05,
    critDmg: 1.5,
    lifesteal: 0,
    defense: 0,
    regen: 0,
  };

  const flags = new Set();
  const quirky = [];

  for (const eff of effects) {
    if (eff.mods) {
      for (const [key, val] of Object.entries(eff.mods)) {
        if (key === 'damage') base.damage += val;
        else if (key === 'maxHp') base.maxHp += val;
        else if (key === 'speed') base.speed *= val;
        else if (key === 'attackSpeed') base.attackSpeed *= val;
        else if (key === 'crit') base.crit += val;
        else if (key === 'critDmg') base.critDmg = val;
        else if (key === 'lifesteal') base.lifesteal += val;
        else if (key === 'defense') base.defense += val;
        else if (key === 'regen') base.regen += val;
      }
    }
    if (eff.flags) eff.flags.forEach(f => flags.add(f));
    if (eff.quirky) quirky.push({ id: eff.badgeId, name: eff.name, desc: eff.desc });
  }

  // Double Everything flag
  if (flags.has('doubleAll')) {
    base.damage *= 2;
    base.maxHp *= 2;
    base.speed *= 2;
  }

  // Pi multiplier
  if (flags.has('piMult')) {
    base.damage *= 3.14;
  }

  return { stats: base, flags, quirky };
}

// Bot names for AI opponents
export const BOT_NAMES = ['RNGbot', 'Dice Lord', 'NumberCrunch', 'PrimeBot', 'RollMaster', 'VoidWalker', 'HexHunter', 'Fibonaccibot'];

// Generate a random bot loadout (simulated badges)
export function generateBotLoadout(difficulty = 1) {
  const allBadgeIds = Object.keys(BADGE_EFFECTS);
  const count = Math.min(2 + difficulty, 5);
  const badges = [];
  const pool = [...allBadgeIds];
  for (let i = 0; i < count && pool.length > 0; i++) {
    const idx = Math.floor(Math.random() * pool.length);
    badges.push(pool[idx]);
    pool.splice(idx, 1);
  }
  return badges;
}