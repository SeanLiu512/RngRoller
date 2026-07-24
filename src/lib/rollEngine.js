// ═══════════════════════════════════════════════
//  ROLL ENGINE — Badge analysis, EP, rarity
// ═══════════════════════════════════════════════

export const RARITY_TIERS = [
  { id: 'trash',    name: 'Trash',    desc: 'Bottom 2%',    pct: '2%' },
  { id: 'common',   name: 'Common',   desc: 'Bottom 50%',   pct: '48%' },
  { id: 'uncommon', name: 'Uncommon', desc: 'Top 50–20%',   pct: '30%' },
  { id: 'rare',     name: 'Rare',     desc: 'Top 20–8%',    pct: '12%' },
  { id: 'epic',     name: 'Epic',     desc: 'Top 8–4%',     pct: '4%' },
  { id: '67_i',     name: '67I',      desc: 'Contains 67',              pct: '~1%' },
  { id: 'anomaly',  name: 'Anomaly',  desc: 'Top 4–0.5%',   pct: '3.5%' },
  { id: '67_ii',    name: '67II',     desc: 'Contains 6767',            pct: '~0.05%' },
  { id: 'mythic',   name: 'Mythic',   desc: 'Top 0.5%',     pct: '0.5%' },
  { id: '67_iii',   name: '67III',    desc: 'Contains 676767',          pct: '< 0.0001%' },
  { id: 'rainbow',  name: 'Rainbow',  desc: 'Beyond Mythic — nearly impossible', pct: '< 0.001%' },
];

// Ordered from lowest to highest — used for confetti thresholds & comparisons.
export const RARITY_ORDER = [
  'trash', 'common', 'uncommon', 'rare', 'epic', '67_i', 'anomaly', '67_ii', 'mythic', '67_iii', 'rainbow',
];

export const RARITY_STYLES = {
  trash:    { text: 'text-yellow-400', border: 'border-yellow-700', bg: 'bg-yellow-950/40', gradient: 'from-yellow-500 to-amber-600',     glow: 'shadow-yellow-500/20',   hex: '#f1c40f' },
  common:   { text: 'text-zinc-300',    border: 'border-zinc-600',    bg: 'bg-zinc-900',      gradient: 'from-zinc-500 to-zinc-700',       glow: 'shadow-zinc-400/20',     hex: '#9ca3af' },
  uncommon: { text: 'text-emerald-400', border: 'border-emerald-700', bg: 'bg-emerald-950/40',gradient: 'from-emerald-500 to-green-600',  glow: 'shadow-emerald-500/40',  hex: '#10b981' },
  rare:     { text: 'text-blue-400',    border: 'border-blue-700',    bg: 'bg-blue-950/40',   gradient: 'from-blue-500 to-cyan-600',       glow: 'shadow-blue-500/40',     hex: '#3b82f6' },
  epic:     { text: 'text-purple-400',  border: 'border-purple-700',  bg: 'bg-purple-950/40', gradient: 'from-purple-500 to-fuchsia-600', glow: 'shadow-purple-500/40',   hex: '#a855f7' },
  anomaly:  { text: 'text-orange-400',  border: 'border-orange-700',  bg: 'bg-orange-950/40',gradient: 'from-orange-500 to-red-600',     glow: 'shadow-orange-500/50',   hex: '#f97316' },
  mythic:   { text: 'text-red-400',    border: 'border-red-600',    bg: 'bg-red-950/40',  gradient: 'from-red-500 to-rose-600',       glow: 'shadow-red-500/50',     hex: '#e74c3c' },
  '67_i':   { text: 'bg-gradient-to-r from-lime-300 to-emerald-400 bg-clip-text text-transparent', border: 'border-lime-500/60', bg: 'bg-lime-950/40', gradient: 'from-lime-400 to-emerald-500', glow: 'shadow-lime-500/50', hex: '#a3e635' },
  '67_ii':  { text: 'bg-gradient-to-r from-fuchsia-400 via-pink-400 to-rose-400 bg-clip-text text-transparent', border: 'border-fuchsia-500/60', bg: 'bg-fuchsia-950/40', gradient: 'from-fuchsia-500 via-pink-500 to-rose-500', glow: 'shadow-fuchsia-500/50', hex: '#e879f9' },
  rainbow:  { text: 'bg-gradient-to-r from-red-400 via-yellow-400 via-green-400 via-blue-400 to-purple-400 bg-clip-text text-transparent', border: 'border-pink-500/60', bg: 'bg-gradient-to-br from-red-950/30 via-yellow-950/20 via-green-950/20 via-blue-950/20 to-purple-950/30', gradient: 'from-red-500 via-yellow-500 via-green-500 via-blue-500 to-purple-500', glow: 'shadow-pink-500/50', hex: '#ff00ff' },
  '67_iii': { text: 'bg-gradient-to-r from-red-400 via-yellow-400 via-green-400 via-blue-400 to-purple-400 bg-clip-text text-transparent', border: 'border-pink-500/60', bg: 'bg-gradient-to-br from-red-950/30 via-yellow-950/20 via-green-950/20 via-blue-950/20 to-purple-950/30', gradient: 'from-red-500 via-yellow-500 via-green-500 via-blue-500 to-purple-500', glow: 'shadow-pink-500/50', hex: '#ff00ff' },
};

const BADGE_RARITY_EP = {
  common: 10,
  uncommon: 1000,
  rare: 10000,
  epic: 100000,
  anomaly: 1000000,
  mythic: 10000000,
  rainbow: 100000000,
};

// ── helpers ──
function isPrime(n) {
  if (n < 2) return false;
  if (n < 4) return true;
  if (n % 2 === 0 || n % 3 === 0) return false;
  for (let i = 5; i * i <= n; i += 6) {
    if (n % i === 0 || n % (i + 2) === 0) return false;
  }
  return true;
}

function isFibonacci(n) {
  const check = (x) => { const r = Math.round(Math.sqrt(x)); return r * r === x; };
  return check(5 * n * n + 4) || check(5 * n * n - 4);
}

function isPerfectPower(n, exp) {
  if (n < 1) return false;
  const r = Math.round(Math.pow(n, 1 / exp));
  return Math.pow(r, exp) === n;
}

function isPerfect(n) {
  if (n < 2) return false;
  let sum = 1;
  for (let i = 2; i * i <= n; i++) {
    if (n % i === 0) {
      sum += i;
      if (i !== n / i) sum += n / i;
    }
  }
  return sum === n;
}

function isMunchausen(n) {
  const digits = String(n).split('').map(Number);
  const power = (d) => d === 0 ? 0 : Math.pow(d, d);
  return digits.reduce((sum, d) => sum + power(d), 0) === n;
}

function isNarcissistic(n) {
  const digits = String(n).split('').map(Number);
  const numDigits = digits.length;
  return digits.reduce((sum, d) => sum + Math.pow(d, numDigits), 0) === n;
}

function digitSum(n) {
  return String(Math.abs(n)).split('').reduce((sum, d) => sum + Number(d), 0);
}

function padded(n) {
  return String(n).padStart(6, '0');
}

// Count the longest run of consecutive "67" pairs in the number string.
// e.g. 67 -> 1, 6767 -> 2, 676767 -> 3
function countConsecutive67(n) {
  const s = String(n);
  let maxRun = 0;
  let run = 0;
  let i = 0;
  while (i <= s.length - 2) {
    if (s[i] === '6' && s[i + 1] === '7') {
      run++;
      if (run > maxRun) maxRun = run;
      i += 2;
    } else {
      run = 0;
      i++;
    }
  }
  return maxRun;
}

// ── additional number property helpers ──
function isHappy(n) {
  if (n < 1) return false;
  let seen = new Set();
  while (n !== 1 && !seen.has(n)) {
    seen.add(n);
    n = String(n).split('').reduce((sum, d) => sum + d * d, 0);
  }
  return n === 1;
}

function isHarshad(n) {
  if (n < 1) return false;
  const digitSum = String(n).split('').reduce((sum, d) => sum + Number(d), 0);
  return digitSum > 0 && n % digitSum === 0;
}

function isAbundant(n) {
  if (n < 12) return false;
  let sum = 1;
  for (let i = 2; i * i <= n; i++) {
    if (n % i === 0) { sum += i; if (i !== n / i) sum += n / i; }
  }
  return sum > n;
}

function isDeficient(n) {
  if (n < 2) return false;
  let sum = 1;
  for (let i = 2; i * i <= n; i++) {
    if (n % i === 0) { sum += i; if (i !== n / i) sum += n / i; }
  }
  return sum < n;
}

function isTriangular(n) {
  if (n < 1) return false;
  const k = (-1 + Math.sqrt(1 + 8 * n)) / 2;
  return Number.isInteger(k);
}

function isHexagonal(n) {
  if (n < 1) return false;
  const k = (1 + Math.sqrt(1 + 8 * n)) / 4;
  return Number.isInteger(k);
}

function isSmith(n) {
  if (n < 2 || isPrime(n)) return false;
  const digitSum = (x) => String(x).split('').reduce((s, d) => s + Number(d), 0);
  const target = digitSum(n);
  let factorSum = 0;
  let temp = n;
  for (let i = 2; i <= temp; i++) {
    while (temp % i === 0) { factorSum += digitSum(i); temp /= i; }
  }
  return factorSum === target;
}

function isAutomorphic(n) {
  if (n < 1) return false;
  return String(n * n).endsWith(String(n));
}

function isKaprekar(n) {
  if (n < 2) return false;
  const s = String(n * n);
  for (let i = 1; i < s.length; i++) {
    const left = Number(s.slice(0, i));
    const right = Number(s.slice(i));
    if (left > 0 && right > 0 && left + right === n) return true;
  }
  return false;
}

function isEvil(n) {
  if (n < 1) return false;
  return n.toString(2).split('').filter(c => c === '1').length % 2 === 0;
}

function isPronic(n) {
  if (n < 2) return false;
  const k = Math.floor(Math.sqrt(n));
  return k * (k + 1) === n;
}

function isLucas(n) {
  if (n < 1) return false;
  let a = 2, b = 1;
  while (a < n) { [a, b] = [b, a + b]; }
  return a === n;
}

function hasEcho(n) {
  const s = String(n);
  for (let i = 0; i <= s.length - 6; i++) {
    if (s.slice(i, i + 3) === s.slice(i + 3, i + 6)) return true;
  }
  return false;
}

// ── badge definitions ──
export const BADGES = [
  // Rainbow (ultra-rare)
  { id: 'perfect_number', name: 'Perfect Number', emoji: '💎', rarity: 'rainbow',  desc: 'A perfect number (6, 28, 496, 8128)',  check: (n) => isPerfect(n) },
  { id: 'munchausen',     name: 'Munchausen',     emoji: '🎪', rarity: 'rainbow',  desc: 'A Munchausen number (3435)',            check: (n) => isMunchausen(n) && n > 1 },
  { id: 'narcissistic',   name: 'Narcissistic',   emoji: '🌸', rarity: 'rainbow',  desc: 'A narcissistic/Armstrong number',      check: (n) => isNarcissistic(n) && n >= 100 },

  // Mythic
  { id: 'one_million',    name: 'One Million',     emoji: '🐐', rarity: 'mythic',   desc: 'Rolled exactly 1,000,000',        check: (n) => n === 1000000 },
  { id: 'the_void',       name: 'The Void',         emoji: '⚫', rarity: 'mythic',   desc: 'Rolled exactly 0',                check: (n) => n === 0 },
  { id: 'pi_digits',      name: 'Pi',               emoji: '🥧', rarity: 'mythic',   desc: 'Contains 314159',                check: (n) => String(n).includes('314159') },
  { id: 'golden_ratio',   name: 'Golden Ratio',     emoji: '🌟', rarity: 'mythic',   desc: 'Contains 161803',                check: (n) => String(n).includes('161803') },
  { id: 'euler',          name: 'Euler',            emoji: '📐', rarity: 'mythic',   desc: 'Contains 271828',                check: (n) => String(n).includes('271828') },

  // Anomaly
  { id: 'binary_soul',    name: 'Binary Soul',      emoji: '🤖', rarity: 'anomaly',  desc: 'All digits are 0 or 1',           check: (n) => /^[01]+$/.test(String(n)) && n > 1 },
  { id: 'sixth_power',    name: '6th Power',        emoji: '🎲', rarity: 'anomaly',  desc: 'A perfect sixth power',           check: (n) => isPerfectPower(n, 6) },
  { id: 'fifth_power',    name: '5th Power',        emoji: '✋', rarity: 'anomaly',  desc: 'A perfect fifth power',           check: (n) => isPerfectPower(n, 5) },
  { id: 'all_same',       name: 'Contiguous All',   emoji: '🌈', rarity: 'anomaly',  desc: 'All digits are the same',         check: (n) => { const s = padded(n); return s.split('').every(d => d === s[0]); } },
  { id: 'six_nines',      name: 'Six Nines',        emoji: '9️⃣', rarity: 'anomaly',  desc: 'Rolled 999,999',                  check: (n) => n === 999999 },
  { id: 'deep_void',      name: 'Deep Void',        emoji: '🕳️', rarity: 'anomaly',  desc: 'Contains 5+ consecutive zeros',   check: (n) => /0{5,}/.test(String(n)) },

  // Epic
  { id: 'perfect_cube',   name: '3rd Power',        emoji: '🧊', rarity: 'epic',     desc: 'A perfect cube',                  check: (n) => isPerfectPower(n, 3) },
  { id: 'contiguous_sixes',name: 'Contiguous Sixes',emoji: '😈', rarity: 'epic',     desc: 'Contains 5+ consecutive sixes',   check: (n) => /6{5,}/.test(padded(n)) },
  { id: 'contiguous_fives',name: 'Contiguous Fives',emoji: '🖐️', rarity: 'epic',     desc: 'Contains 5+ consecutive fives',   check: (n) => /5{5,}/.test(padded(n)) },
  { id: 'contiguous_fours',name:'Contiguous Fours', emoji: '4️⃣', rarity: 'epic',     desc: 'Contains 4+ consecutive fours',   check: (n) => /4{4,}/.test(padded(n)) },
  { id: 'counting_up',    name: 'Ascending',        emoji: '📈', rarity: 'epic',     desc: 'Digits count up (123456)',        check: (n) => padded(n) === '123456' },
  { id: 'counting_down',  name: 'Descending',       emoji: '📉', rarity: 'epic',     desc: 'Digits count down (654321)',      check: (n) => padded(n) === '654321' },
  { id: 'sequential',     name: 'Sequential',       emoji: '🔗', rarity: 'epic',     desc: 'Consecutive ascending/descending',check: (n) => { const s = padded(n); let a = true, d = true; for (let i = 1; i < s.length; i++) { if (+s[i] !== +s[i-1]+1) a = false; if (+s[i] !== +s[i-1]-1) d = false; } return a || d; } },

  // Rare
  { id: 'prime',          name: 'Prime',            emoji: '🔒', rarity: 'rare',     desc: 'A prime number',                  check: (n) => isPrime(n) },
  { id: 'perfect_square', name: 'Perfect Square',   emoji: '⬜', rarity: 'rare',     desc: 'A perfect square',                check: (n) => isPerfectPower(n, 2) },
  { id: 'palindrome',     name: 'Palindrome',       emoji: '🪞', rarity: 'rare',     desc: 'Reads same forwards & backwards', check: (n) => { const s = String(n); return s.length > 1 && s === s.split('').reverse().join(''); } },
  { id: 'fibonacci',      name: 'Fibonacci',         emoji: '🌀', rarity: 'rare',     desc: 'A Fibonacci number',              check: (n) => isFibonacci(n) },
  { id: 'triple_seven',   name: 'Triple Seven',     emoji: '🎰', rarity: 'rare',     desc: 'Contains 777',                    check: (n) => String(n).includes('777') },
  { id: 'triple_six',     name: 'Triple Six',       emoji: '😈', rarity: 'rare',     desc: 'Contains 666',                    check: (n) => String(n).includes('666') },
  { id: 'repeated_digit', name: 'Repeated Digit',   emoji: '🔁', rarity: 'rare',     desc: 'A digit appears 4+ times',         check: (n) => { const s = String(n); const c = {}; for (const d of s) c[d] = (c[d]||0)+1; return Object.values(c).some(v => v >= 4); } },

  // Uncommon
  { id: 'meme_69',        name: 'Nice',             emoji: '😏', rarity: 'uncommon', desc: 'Contains 69',                    check: (n) => String(n).includes('69') },
  { id: 'meme_420',       name: 'Blaze It',          emoji: '🌿', rarity: 'uncommon', desc: 'Contains 420',                   check: (n) => String(n).includes('420') },
  { id: 'meme_1337',      name: 'Leet',              emoji: '💻', rarity: 'uncommon', desc: 'Contains 1337',                  check: (n) => String(n).includes('1337') },
  { id: 'meme_8008',      name: 'BOOBS',            emoji: '🎱', rarity: 'uncommon', desc: 'Contains 8008',                  check: (n) => String(n).includes('8008') },
  { id: 'meme_69420',     name: 'Ultimate Meme',    emoji: '🎊', rarity: 'uncommon', desc: 'Contains 69420',                 check: (n) => String(n).includes('69420') },
  { id: 'divisible_100',  name: 'Century',          emoji: '💯', rarity: 'uncommon', desc: 'Divisible by 100',               check: (n) => n > 0 && n % 100 === 0 },
  { id: 'three_kind',     name: 'Three of a Kind',  emoji: '🎲', rarity: 'uncommon', desc: 'A digit appears 3+ times',       check: (n) => { const s = String(n); const c = {}; for (const d of s) c[d] = (c[d]||0)+1; return Object.values(c).some(v => v >= 3); } },
  { id: 'mirror',         name: 'Mirror',           emoji: '🪟', rarity: 'uncommon', desc: 'First half mirrors second half',  check: (n) => { const s = padded(n); return s.slice(0,3) === s.slice(3); } },

  // Common
  { id: 'divisible_2',    name: 'Even',             emoji: '⚖️', rarity: 'common',   desc: 'An even number',                 check: (n) => n % 2 === 0 },
  { id: 'divisible_3',    name: 'Triple',           emoji: '3️⃣', rarity: 'common',   desc: 'Divisible by 3',                 check: (n) => n % 3 === 0 },
  { id: 'divisible_5',    name: 'Fiver',            emoji: '5️⃣', rarity: 'common',   desc: 'Divisible by 5',                 check: (n) => n % 5 === 0 },
  { id: 'divisible_7',    name: 'Lucky Seven',      emoji: '🍀', rarity: 'common',   desc: 'Divisible by 7',                 check: (n) => n % 7 === 0 },
  { id: 'contains_zero',  name: 'Contains Zero',   emoji: '⭕', rarity: 'common',   desc: 'Contains the digit 0',           check: (n) => String(n).includes('0') },
  { id: 'ends_zero',      name: 'Round Number',     emoji: '🔵', rarity: 'common',   desc: 'Ends in zero',                   check: (n) => n % 10 === 0 },

  // ── element & number property badges ──
  // Common
  { id: 'hydrogen',     name: 'Hydrogen',       emoji: '💧', rarity: 'common',   desc: 'Atomic #1',                         check: (n) => n === 1 },
  { id: 'evil',         name: 'Evil',           emoji: '🦹', rarity: 'common',   desc: 'Even number of 1s in binary',       check: (n) => isEvil(n) },
  { id: 'deficient',    name: 'Deficient',      emoji: '⬇️', rarity: 'common',   desc: 'Sum of divisors is less than n',    check: (n) => isDeficient(n) },

  // Uncommon
  { id: 'boron',        name: 'Boron',          emoji: '🟤', rarity: 'uncommon', desc: 'Atomic #5',                         check: (n) => n === 5 },
  { id: 'carbon',       name: 'Carbon',         emoji: '🅱️', rarity: 'uncommon', desc: 'Atomic #6',                         check: (n) => n === 6 },
  { id: 'oxygen',       name: 'Oxygen',          emoji: '🫁', rarity: 'uncommon', desc: 'Atomic #8',                         check: (n) => n === 8 },
  { id: 'happy',        name: 'Happy',          emoji: '😊', rarity: 'uncommon', desc: 'A happy number',                    check: (n) => isHappy(n) },
  { id: 'harshad',      name: 'Harshad',         emoji: '🧮', rarity: 'uncommon', desc: 'Divisible by its digit sum',        check: (n) => isHarshad(n) },
  { id: 'abundant',     name: 'Abundant',        emoji: '📦', rarity: 'uncommon', desc: 'Sum of divisors exceeds n',         check: (n) => isAbundant(n) },
  { id: 'pronic',       name: 'Pronic',          emoji: '📐', rarity: 'uncommon', desc: 'Product of two consecutive integers', check: (n) => isPronic(n) },

  // Rare
  { id: 'gold',         name: 'Gold',            emoji: '🥇', rarity: 'rare',     desc: 'Atomic #79',                        check: (n) => n === 79 },
  { id: 'triangular',   name: 'Triangular',      emoji: '🔺', rarity: 'rare',     desc: 'A triangular number',              check: (n) => isTriangular(n) },
  { id: 'smith',        name: 'Smith',            emoji: '🔨', rarity: 'rare',     desc: 'A Smith number',                    check: (n) => isSmith(n) },
  { id: 'lucas',        name: 'Lucas',            emoji: '🔢', rarity: 'rare',     desc: 'A Lucas number',                    check: (n) => isLucas(n) },
  { id: 'hexagonal',    name: 'Hexagonal',        emoji: '⬡',  rarity: 'rare',     desc: 'A hexagonal number',                check: (n) => isHexagonal(n) },
  { id: 'echo',         name: 'Echo',             emoji: '🔊', rarity: 'rare',     desc: 'Contains a repeated 3-digit block', check: (n) => hasEcho(n) },

  // Epic
  { id: 'uranium',      name: 'Uranium',         emoji: '☢️', rarity: 'epic',     desc: 'Atomic #92',                        check: (n) => n === 92 },
  { id: 'automorphic',  name: 'Automorphic',     emoji: '🔄', rarity: 'epic',     desc: 'Square ends in itself',             check: (n) => isAutomorphic(n) },
  { id: 'kaprekar',     name: 'Kaprekar',        emoji: '🎯', rarity: 'epic',     desc: 'A Kaprekar number',                 check: (n) => isKaprekar(n) },

  // ── new badges (July 2026 update) ──
  { id: 'square_root',   name: 'Root Focus',     emoji: '√',  rarity: 'common',   desc: 'Digit sum is a perfect square',     check: (n) => { const s = digitSum(n); const r = Math.round(Math.sqrt(s)); return r * r === s; } },
  { id: 'even_digits',   name: 'Even Footing',   emoji: '🟢', rarity: 'uncommon', desc: 'Every digit is even',               check: (n) => padded(n).split('').every(d => Number(d) % 2 === 0) },
  { id: 'odd_digits',    name: "Odd One's Edge", emoji: '🟠', rarity: 'uncommon', desc: 'Every digit is odd',                check: (n) => padded(n).split('').every(d => Number(d) % 2 === 1) },
  { id: 'lucky_number',  name: 'Fourleaf Fortune', emoji: '🍀', rarity: 'common',  desc: 'Contains exactly two 7s',           check: (n) => (String(n).match(/7/g) || []).length === 2 },
  { id: 'vampire_number', name: 'Vampiric Split', emoji: '🧛', rarity: 'common',  desc: 'Contains 13',                       check: (n) => String(n).includes('13') },
  { id: 'half_balance',  name: 'Balanced Halves', emoji: '⚖️', rarity: 'uncommon', desc: 'Both halves have equal digit sums', check: (n) => { const s = padded(n); return digitSum(Number(s.slice(0, 3))) === digitSum(Number(s.slice(3))); } },
  { id: 'twin_prime',    name: 'Twin Strike',     emoji: '👯', rarity: 'rare',    desc: 'Prime with a prime neighbor (±2)',  check: (n) => isPrime(n) && (isPrime(n - 2) || isPrime(n + 2)) },
  { id: 'ricochet',      name: 'Ricochet Rounds', emoji: '🎾', rarity: 'common',  desc: 'Contains 88',                       check: (n) => String(n).includes('88') },
  { id: 'glass_cannon',  name: 'Glass Cannon',    emoji: '💥', rarity: 'epic',    desc: 'Digit sum is 45 or higher',         check: (n) => digitSum(n) >= 45 },
  { id: 'fortress',      name: 'Fortress Stance', emoji: '🏰', rarity: 'uncommon', desc: 'Divisible by 36',                  check: (n) => n > 0 && n % 36 === 0 },
  { id: 'berserker',     name: "Berserker's Rage", emoji: '😡', rarity: 'uncommon', desc: 'Divisible by 56',                 check: (n) => n > 0 && n % 56 === 0 },
  { id: 'phoenix',       name: 'Phoenix Regen',   emoji: '🔥', rarity: 'uncommon', desc: 'Contains 3 consecutive ascending digits', check: (n) => { const s = padded(n); for (let i = 0; i < s.length - 2; i++) { if (+s[i+1] === +s[i]+1 && +s[i+2] === +s[i]+2) return true; } return false; } },
  { id: 'quintuple',     name: 'Quintuple Threat', emoji: '5️⃣', rarity: 'rare',   desc: 'Divisible by 125',                 check: (n) => n > 0 && n % 125 === 0 },
  { id: 'overclock',     name: 'Overclocked Core', emoji: '⚡', rarity: 'epic',   desc: 'Contains 999',                     check: (n) => String(n).includes('999') },
];

// EP thresholds significantly lowered to boost rarity drop rates across the board.
export function getRarityFromEP(ep) {
  if (ep <= 10) return 'trash';
  if (ep <= 80) return 'common';
  if (ep <= 800) return 'uncommon';
  if (ep <= 8000) return 'rare';
  if (ep <= 80000) return 'epic';
  if (ep <= 800000) return 'anomaly';
  if (ep <= 8000000) return 'mythic';
  return 'rainbow';
}

export function analyzeRoll(number) {
  const earned = BADGES.filter(b => b.check(number));
  let ep = earned.reduce((sum, b) => sum + BADGE_RARITY_EP[b.rarity], 0);
  let rarity = getRarityFromEP(ep);

  // 67 rarity — overrides the EP-based rarity when consecutive "67" runs are found.
  // Higher consecutive runs → rarer level. 67III is Rainbow-tier.
  const run = countConsecutive67(number);
  if (run >= 3) {
    rarity = '67_iii';
    ep += 1000000;
  } else if (run >= 2) {
    rarity = '67_ii';
    ep += 100000;
  } else if (run >= 1) {
    rarity = '67_i';
    ep += 10000;
  }

  return {
    number,
    badges: earned.map(b => b.id),
    ep,
    rarity,
  };
}

export function getBadgeById(id) {
  return BADGES.find(b => b.id === id);
}

export function getRarityInfo(id) {
  return RARITY_TIERS.find(r => r.id === id) || RARITY_TIERS[1];
}

export function getRarityStyle(id) {
  return RARITY_STYLES[id] || RARITY_STYLES.common;
}

export function getRarityRank(id) {
  return RARITY_ORDER.indexOf(id);
}

export function formatEP(ep) {
  return ep.toLocaleString('en-US');
}

// ═══════════════════════════════════════════════
//  SHOP ITEMS — Purchasable with EP
// ═══════════════════════════════════════════════
export const SHOP_ITEMS = [
  {
    id: 'lucky_charm',
    name: 'Lucky Charm',
    emoji: '🍀',
    desc: 'Slightly increases next roll quality. Rerolls once if result is below Uncommon (takes the better).',
    price: 2000,
    type: 'consumable',
  },
  {
    id: '2x_ep',
    name: '2x EP Boost',
    emoji: '⚡',
    desc: 'Doubles the EP earned on your next roll.',
    price: 5000,
    type: 'consumable',
  },
  {
    id: '5x_ep',
    name: '5x EP Boost',
    emoji: '🔥',
    desc: '5x the EP earned on your next roll.',
    price: 25000,
    type: 'consumable',
  },
  {
    id: 'custom_badge',
    name: 'Custom Badge Unlock',
    emoji: '🎨',
    desc: 'Permanently unlocks the Custom Badge Creator without needing a Rainbow roll.',
    price: 100000,
    type: 'permanent',
  },
  {
    id: 'vip_title',
    name: 'VIP Title',
    emoji: '⭐',
    desc: 'Permanently shows ⭐ VIP next to your name on the leaderboard.',
    price: 50000,
    type: 'permanent',
  },
];