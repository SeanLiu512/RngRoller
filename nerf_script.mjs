import * as rollEngine from './src/lib/rollEngine.js';
import * as arenaConfig from './src/lib/arenaConfig.js';
import fs from 'fs';

const rarityById = {};
for (const b of rollEngine.BADGES) rarityById[b.id] = b.rarity;
rarityById['67_i'] = 'rainbow';
rarityById['67_ii'] = 'rainbow';
rarityById['67_iii'] = 'rainbow';

const factors = {
  common: 0,
  uncommon: 0.25,
  rare: 0.4,
  epic: 0.55,
  anomaly: 0.65,
  mythic: 0.75,
  rainbow: 0.8,
};

function round(n) {
  return Math.round(n * 1000) / 1000;
}

function nerfMod(key, val, factor) {
  if (key === 'speed' || key === 'attackSpeed') {
    return round(1 + (val - 1) * factor);
  }
  if (key === 'critDmg') {
    return round(1.5 + (val - 1.5) * factor);
  }
  // damage, maxHp, crit, lifesteal, defense, regen: plain additive scaling
  return round(val * factor);
}

let srcPath = './src/lib/arenaConfig.js';
let src = fs.readFileSync(srcPath, 'utf-8');

for (const [id, eff] of Object.entries(arenaConfig.BADGE_EFFECTS)) {
  const rarity = rarityById[id] || 'uncommon';
  const factor = factors[rarity];

  const newMods = {};
  if (eff.mods) {
    for (const [k, v] of Object.entries(eff.mods)) {
      newMods[k] = nerfMod(k, v, factor);
    }
  }

  // Common tier: also strip flags entirely (fully inert).
  const newFlags = rarity === 'common' ? [] : (eff.flags || null);

  // Find this badge's line in the source. Keys can be bare identifiers
  // or quoted (e.g. '67_i'). Match up to the mods:{...} and/or flags:[...] segments.
  const idPattern = id.match(/^[A-Za-z_$][A-Za-z0-9_$]*$/) ? id : `'${id}'`;
  const lineRegex = new RegExp(`(^\\s*${idPattern.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\$&')}:\\s*\\{.*\\},?\\s*$)`, 'm');
  const match = src.match(lineRegex);
  if (!match) {
    console.error('NO MATCH for', id);
    continue;
  }
  let line = match[1];

  // Replace mods:{...} if present in this line.
  if (/mods:\s*\{[^}]*\}/.test(line)) {
    const modsStr = Object.entries(newMods).map(([k, v]) => `${k}: ${v}`).join(', ');
    line = line.replace(/mods:\s*\{[^}]*\}/, `mods: { ${modsStr} }`);
  }

  // Replace flags:[...] only for common-tier badges (strip to empty).
  if (rarity === 'common' && /flags:\s*\[[^\]]*\]/.test(line)) {
    line = line.replace(/flags:\s*\[[^\]]*\]/, `flags: []`);
  }

  src = src.replace(match[1], line);
}

fs.writeFileSync(srcPath, src);
console.log('Done rewriting', srcPath);
