import { db } from '@/api/client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';

import { useAuth } from '@/lib/AuthContext';
import { analyzeRoll, getRarityStyle, getRarityRank, formatEP } from '@/lib/rollEngine';
import { APP_NAME, APP_TAGLINE, MAX_NUMBER } from '@/lib/config';
import RollDisplay from '@/components/RollDisplay';
import EquippedBadge from '@/components/EquippedBadge';
import DigitReel from '@/components/DigitReel';
import { Dices, Trophy, Sparkles, TrendingUp, Zap, Clock } from 'lucide-react';
import confetti from 'canvas-confetti';

const todayStr = () => new Date().toISOString().split('T')[0];

const REEL_BASE_DELAY = 1100;
const REEL_INCREMENT = 180;
const REEL_TRANSITION = 850;
const RESULT_PAUSE = 250;

const COOLDOWN_MS = 60 * 1000; // 1 minute

const formatCooldown = (ms) => {
  const mins = Math.floor(ms / 60000);
  const secs = Math.floor((ms % 60000) / 1000);
  return `${mins}:${String(secs).padStart(2, '0')}`;
};

export default function Home() {
  const { user, isAuthenticated, checkUserAuth } = useAuth();
  const [phase, setPhase] = useState('idle'); // idle | rolling | result
  const [roll, setRoll] = useState(null);
  const [spinDigits, setSpinDigits] = useState([0, 0, 0, 0, 0, 0]);
  const [spinId, setSpinId] = useState(0);
  const [isFetchingRoll, setIsFetchingRoll] = useState(false);
  const [todayBest, setTodayBest] = useState(null);
  const [rollsToday, setRollsToday] = useState(0);
  const [totalEPToday, setTotalEPToday] = useState(0);
  const [loading, setLoading] = useState(true);
  const [cooldownEnds, setCooldownEnds] = useState(0);
  const [cooldownRemaining, setCooldownRemaining] = useState(0);
  const justRolledRef = useRef(false);

  const fetchDailyData = useCallback(async () => {
    try {
      const [best, allToday] = await Promise.all([
        db.entities.Roll.filter({ roll_date: todayStr() }, '-ep', 1),
        db.entities.Roll.filter({ roll_date: todayStr() }, '-ep', 200),
      ]);
      setTodayBest(best[0] || null);
      setRollsToday(allToday.length);
      setTotalEPToday(allToday.reduce((s, r) => s + (r.ep || 0), 0));
    } catch { /* empty */ }
  }, []);

  const checkLastRoll = useCallback(async () => {
    // Check localStorage first — works for all users even before auth loads
    const stored = localStorage.getItem('lastRollTime');
    if (stored) {
      const ends = parseInt(stored, 10) + COOLDOWN_MS;
      if (ends > Date.now()) setCooldownEnds(ends);
    }
    if (!isAuthenticated || !user) return;
    // Never clobber a result that was just shown this session — this is
    // purely for restoring state on a fresh page load, not for re-checking
    // mid-session (which could otherwise flash a different roll into view
    // if this ever re-runs after the user already sees their real result).
    if (justRolledRef.current) return;
    try {
      const myRolls = await db.entities.Roll.filter(
        { created_by_id: user.id },
        '-created_date', 1
      );
      if (myRolls.length > 0) {
        setRoll(myRolls[0]);
        setPhase('result');
        const ends = new Date(myRolls[0].created_date).getTime() + COOLDOWN_MS;
        if (ends > Date.now()) setCooldownEnds(ends);
      }
    } catch { /* empty */ }
  }, [isAuthenticated, user]);

  useEffect(() => {
    (async () => {
      await Promise.all([fetchDailyData(), checkLastRoll()]);
      setLoading(false);
    })();
  }, [fetchDailyData, checkLastRoll]);

  useEffect(() => {
    if (!cooldownEnds) return;
    const tick = () => {
      const remaining = cooldownEnds - Date.now();
      setCooldownRemaining(remaining > 0 ? remaining : 0);
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [cooldownEnds]);

  const handleRoll = async () => {
    if (phase === 'rolling' || cooldownRemaining > 0) return;

    // Set this immediately, not just after the animation finishes — the
    // entire fetch+animation window needs to be protected from a
    // background refresh (checkLastRoll) overwriting the in-progress
    // result with a stale one (e.g. read-replica lag briefly returning
    // yesterday's roll instead of the one just created).
    justRolledRef.current = true;

    const boost = user?.active_boost || '';

    // Fetch (or compute, for guests) the REAL result first. The reel's
    // spin animation locks in its target the instant it starts and can
    // never be corrected mid-flight — so if we started spinning toward a
    // locally-guessed number and only found out the true (server) result
    // afterward, the display would show one result and then instantly
    // flip to a different one. That's exactly the bug this fixes: the
    // server generates its own independent random roll, so a client-side
    // guess almost never matches it.
    setPhase('rolling');
    setIsFetchingRoll(true);

    let finalNumber, result, saved = null;
    if (isAuthenticated && user) {
      try {
        saved = await db.game.roll();
        finalNumber = saved.number;
        result = { ep: saved.ep, rarity: saved.rarity, badges: saved.badges };
      } catch (err) {
        setIsFetchingRoll(false);
        setPhase('idle');
        if (err?.status === 429) {
          alert(err.message || 'You must wait before rolling again.');
        } else {
          alert(err.message || 'Something went wrong — please try again.');
        }
        return;
      }
    } else {
      // Guests aren't saved anywhere, so a local roll is fine here.
      finalNumber = Math.floor(Math.random() * (MAX_NUMBER + 1));
      result = analyzeRoll(finalNumber);
    }

    // Lucky Charm: reroll once if below uncommon (guests only — for
    // logged-in users this is already handled server-side).
    if (!saved && boost === 'lucky_charm' && getRarityRank(result.rarity) < getRarityRank('uncommon')) {
      const rerollNum = Math.floor(Math.random() * (MAX_NUMBER + 1));
      const rerollResult = analyzeRoll(rerollNum);
      if (rerollResult.ep > result.ep) {
        finalNumber = rerollNum;
        result = rerollResult;
      }
    }
    if (!saved && boost === '2x_ep') result.ep *= 2;
    if (!saved && boost === '5x_ep') result.ep *= 5;

    setIsFetchingRoll(false);

    const padded = String(finalNumber).padStart(6, '0');
    const digits = padded.split('').map(Number);

    setSpinDigits(digits);
    setSpinId((prev) => prev + 1);

    const totalDelay =
      REEL_BASE_DELAY +
      (digits.length - 1) * REEL_INCREMENT +
      REEL_TRANSITION +
      RESULT_PAUSE;

    setTimeout(() => {
      // Start cooldown
      const rollTime = Date.now();
      setCooldownEnds(rollTime + COOLDOWN_MS);
      localStorage.setItem('lastRollTime', String(rollTime));

      // confetti for rare+
      if (getRarityRank(result.rarity) >= getRarityRank('rare')) {
        const style = getRarityStyle(result.rarity);
        const isTopTier = getRarityRank(result.rarity) >= getRarityRank('rainbow');
        const isEpicPlus = getRarityRank(result.rarity) >= getRarityRank('epic');
        const colors = isTopTier
          ? ['#ff00ff', '#ffff00', '#00ffff', '#ff0066', '#00ff66', '#ffffff']
          : [style.hex, '#ffffff'];

        // Main burst
        confetti({
          particleCount: isTopTier ? 200 : isEpicPlus ? 140 : 90,
          spread: isTopTier ? 120 : isEpicPlus ? 90 : 70,
          origin: { y: 0.6 },
          colors,
        });

        // Second burst for epic+
        if (isEpicPlus) {
          setTimeout(() => confetti({
            particleCount: isTopTier ? 150 : 100,
            spread: 100,
            origin: { y: 0.4 },
            colors,
          }), 200);
        }

        // Side cannons + extra burst for top tier
        if (isTopTier) {
          setTimeout(() => {
            confetti({ particleCount: 80, angle: 60, spread: 70, origin: { x: 0, y: 0.7 }, colors });
            confetti({ particleCount: 80, angle: 120, spread: 70, origin: { x: 1, y: 0.7 }, colors });
          }, 400);
          setTimeout(() => confetti({ particleCount: 100, spread: 140, origin: { y: 0.3 }, colors }), 600);
        }
      }

      setRoll(saved || result);
      setPhase('result');
      justRolledRef.current = true;
      if (saved) fetchDailyData();
    }, totalDelay);
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-zinc-800 border-t-violet-500" />
      </div>
    );
  }

  return (
    <div className="relative mx-auto max-w-2xl px-4 py-10 sm:py-16">
      {/* Ambient background glow */}
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute left-1/2 top-0 h-[40rem] w-[40rem] -translate-x-1/2 rounded-full bg-violet-600/10 blur-[120px]" />
        <div className="absolute right-0 top-1/3 h-[24rem] w-[24rem] rounded-full bg-fuchsia-600/10 blur-[100px]" />
      </div>

      {/* Hero */}
      <div className="mb-10 text-center">
        <h1 className="mb-3 text-4xl font-black tracking-tight sm:text-6xl">
          <span className="bg-gradient-to-r from-violet-400 via-fuchsia-400 to-violet-400 bg-clip-text text-transparent drop-shadow-[0_0_30px_rgba(167,139,250,0.35)]">
            {APP_NAME}
          </span>
        </h1>
        <p className="text-zinc-500">{APP_TAGLINE}</p>
      </div>

      {/* Roll area */}
      {phase === 'idle' && (
        <div className="flex flex-col items-center gap-6">
          <button
            onClick={handleRoll}
            disabled={cooldownRemaining > 0}
            className={`group relative flex h-48 w-48 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-600 text-white shadow-2xl shadow-violet-500/50 transition ${
              cooldownRemaining > 0 ? 'opacity-50 cursor-not-allowed' : 'hover:scale-105 active:scale-95'
            }`}
          >
            <span className="absolute inset-0 animate-ping rounded-full bg-violet-500/30" />
            <span className="absolute -inset-1 rounded-full bg-gradient-to-br from-violet-400/40 to-fuchsia-500/40 blur-lg transition group-hover:blur-xl" />
            <div className="relative flex flex-col items-center gap-2">
              <Dices className="h-14 w-14 drop-shadow-lg" />
              <span className="text-lg font-black uppercase tracking-wider">Roll</span>
            </div>
          </button>
          {cooldownRemaining > 0 ? (
            <div className="flex items-center gap-1.5 text-xs font-medium text-amber-400">
              <Clock className="h-3.5 w-3.5" />
              Next roll in {formatCooldown(cooldownRemaining)}
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-xs font-medium text-emerald-400">
              <Zap className="h-3.5 w-3.5" />
              Ready to roll!
            </div>
          )}
          {!isAuthenticated && (
            <p className="text-center text-sm text-zinc-500">
              <Link to="/register" className="font-semibold text-violet-400 hover:underline">Sign up</Link> to save your rolls and climb the leaderboard
            </p>
          )}
        </div>
      )}

      {phase === 'rolling' && (
        <div className="flex flex-col items-center gap-6 py-8">
          {isFetchingRoll ? (
            <div className="flex h-16 items-center justify-center">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-zinc-800 border-t-violet-500" />
            </div>
          ) : (
            <div className="flex justify-center gap-1.5 rounded-2xl border border-zinc-800/80 bg-zinc-950/60 p-3 shadow-2xl shadow-violet-500/10">
              {spinDigits.map((d, i) => (
                <DigitReel
                  key={i}
                  index={i}
                  targetDigit={d}
                  spinId={spinId}
                  stopDelay={REEL_BASE_DELAY + i * REEL_INCREMENT}
                />
              ))}
            </div>
          )}
          <p className="animate-pulse text-sm font-medium text-zinc-400">Rolling...</p>
        </div>
      )}

      {phase === 'result' && roll && (
        <div className="space-y-4">
          <RollDisplay roll={roll} animate />
          {/* Roll again */}
          <div className="flex justify-center">
            <button
              onClick={handleRoll}
              disabled={cooldownRemaining > 0}
              className={`group flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-500 to-fuchsia-600 px-7 py-3 text-sm font-bold text-white shadow-lg shadow-violet-500/30 transition ${
                cooldownRemaining > 0 ? 'opacity-50 cursor-not-allowed' : 'hover:scale-105 active:scale-95'
              }`}
            >
              {cooldownRemaining > 0 ? (
                <>
                  <Clock className="h-4 w-4" />
                  Next roll in {formatCooldown(cooldownRemaining)}
                </>
              ) : (
                <>
                  <Dices className="h-4 w-4 transition group-hover:rotate-12" />
                  Roll Again
                </>
              )}
            </button>
          </div>
          {!isAuthenticated && (
            <p className="text-center text-sm text-zinc-500">
              <Link to="/register" className="font-semibold text-violet-400 hover:underline">Create an account</Link> to save your rolls and compete
            </p>
          )}
        </div>
      )}

      {/* Today's Best */}
      <div className="mt-12 space-y-4">
        <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-zinc-500">
          <Sparkles className="h-4 w-4" />
          Today's Best Roll
        </div>
        {todayBest ? (
          <div className={`flex items-center justify-between rounded-2xl border ${getRarityStyle(todayBest.rarity).border} bg-zinc-900/50 p-4 transition hover:scale-[1.01]`}>
            <div className="flex items-center gap-3">
              <span className={`text-2xl font-black tabular-nums ${getRarityStyle(todayBest.rarity).text}`}>
                {todayBest.number.toLocaleString('en-US')}
              </span>
              <span className="flex items-center gap-1.5 text-sm text-zinc-500">
                by {todayBest.roller_name || 'Unknown'}
                <EquippedBadge
                  badgeId={todayBest.equipped_badge}
                  customName={todayBest.custom_badge_name}
                  customImage={todayBest.custom_badge_image}
                />
              </span>
            </div>
            <div className="text-right">
              <div className={`text-sm font-bold ${getRarityStyle(todayBest.rarity).text}`}>{formatEP(todayBest.ep)} EP</div>
              <div className="text-xs text-zinc-600">{todayBest.badges?.length || 0} badges</div>
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/30 p-4 text-center text-sm text-zinc-600">
            No rolls yet today. Be the first!
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-3 text-center transition hover:border-zinc-700">
            <TrendingUp className="mx-auto mb-1 h-4 w-4 text-zinc-500" />
            <div className="text-lg font-bold text-zinc-200">{rollsToday.toLocaleString()}</div>
            <div className="text-xs text-zinc-500">Rolls today</div>
          </div>
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-3 text-center transition hover:border-zinc-700">
            <Trophy className="mx-auto mb-1 h-4 w-4 text-zinc-500" />
            <div className="text-lg font-bold text-zinc-200">{formatEP(totalEPToday)}</div>
            <div className="text-xs text-zinc-500">Total EP today</div>
          </div>
        </div>

        <Link
          to="/leaderboard"
          className="flex items-center justify-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900/50 py-3 text-sm font-semibold text-zinc-300 transition hover:bg-zinc-800 hover:border-zinc-700"
        >
          <Trophy className="h-4 w-4" />
          View Leaderboard
        </Link>
      </div>
    </div>
  );
}