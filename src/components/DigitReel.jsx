import { useRef, useEffect, useState } from 'react';

const DIGITS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 0]; // duplicate 0 for seamless wrap
const DIGIT_H = 4; // rem (matches h-16)
const STRIP_H = 40; // 10 digits × 4rem

export default function DigitReel({ targetDigit, spinId, stopDelay, index = 0 }) {
  const stripRef = useRef(null);
  const rafRef = useRef(null);
  const [locked, setLocked] = useState(false);
  const [spinning, setSpinning] = useState(false);

  useEffect(() => {
    const strip = stripRef.current;
    if (!strip) return;

    // Initial mount (no spin yet) — show target digit
    if (spinId === 0) {
      strip.style.transition = 'none';
      strip.style.transform = `translateY(-${targetDigit * DIGIT_H}rem)`;
      return;
    }

    setLocked(false);
    setSpinning(true);

    // Start spinning
    strip.style.transition = 'none';
    const startTime = performance.now();
    const SPIN_SPEED = 72; // rem per second
    let currentY = 0;
    let snapTimer = null;
    let lockTimer = null;

    const animate = (now) => {
      const elapsed = now - startTime;

      if (elapsed < stopDelay) {
        // Spinning phase — continuously scroll down, wrapping
        currentY = -((elapsed / 1000) * SPIN_SPEED);
        const wrapped = currentY % STRIP_H; // keeps value in (-40, 0]
        strip.style.transform = `translateY(${wrapped}rem)`;
        rafRef.current = requestAnimationFrame(animate);
      } else {
        // Stopping — find target position below current, then decelerate
        const currentWrapped = currentY % STRIP_H;
        const targetBase = -(targetDigit * DIGIT_H);
        let target = targetBase;
        const MIN_TRAVEL = 8; // ensure at least 2 digits of travel
        while (target > currentWrapped - MIN_TRAVEL) {
          target -= STRIP_H;
        }
        strip.style.transition = 'transform 0.85s cubic-bezier(0.16, 1, 0.3, 1)';
        strip.style.transform = `translateY(${target}rem)`;
        setSpinning(false);

        // Lock-in flash the instant it physically settles into place.
        lockTimer = setTimeout(() => setLocked(true), 850);

        // After transition, snap to equivalent wrapped position (prevent overflow)
        snapTimer = setTimeout(() => {
          if (stripRef.current) {
            const finalY = target % STRIP_H;
            stripRef.current.style.transition = 'none';
            stripRef.current.style.transform = `translateY(${finalY}rem)`;
            stripRef.current.dataset.settled = 'true';
          }
        }, 900);
      }
    };

    rafRef.current = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(rafRef.current);
      if (snapTimer) clearTimeout(snapTimer);
      if (lockTimer) clearTimeout(lockTimer);
    };
  }, [spinId]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div
      className={`group relative h-16 w-11 overflow-hidden rounded-xl border bg-gradient-to-b from-zinc-900 via-zinc-950 to-zinc-900 shadow-lg ring-1 ring-white/5 transition-[border-color,box-shadow] duration-200 sm:w-12 ${
        locked
          ? 'border-violet-400/80 shadow-violet-500/40'
          : 'border-zinc-700/80 shadow-violet-500/10'
      }`}
      style={{ animationDelay: `${index * 60}ms` }}
    >
      {/* Glow accent */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-violet-500/5 to-transparent" />
      {/* Glossy diagonal sheen sweep while spinning — real slot-machine reels
          have a light source catching the glass; this fakes that. */}
      {spinning && (
        <div
          className="pointer-events-none absolute inset-0 z-20 animate-[sheen_0.7s_linear_infinite]"
          style={{
            background: 'linear-gradient(115deg, transparent 20%, rgba(255,255,255,0.12) 45%, rgba(255,255,255,0.22) 50%, rgba(255,255,255,0.12) 55%, transparent 80%)',
          }}
        />
      )}
      {/* Lock-in flash — a bright pulse the instant the digit settles */}
      {locked && (
        <div className="pointer-events-none absolute inset-0 z-30 animate-[lockFlash_0.5s_ease-out_forwards] bg-white" />
      )}
      {/* Fade gradients for slot-machine feel */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-5 bg-gradient-to-b from-zinc-950 via-zinc-950/80 to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-5 bg-gradient-to-t from-zinc-950 via-zinc-950/80 to-transparent" />
      {/* Center highlight line */}
      <div className="pointer-events-none absolute inset-x-0 top-1/2 z-20 h-px -translate-y-1/2 bg-violet-400/10" />
      <div ref={stripRef} className="flex flex-col will-change-transform">
        {DIGITS.map((d, i) => (
          <div
            key={i}
            className="flex h-16 items-center justify-center text-5xl font-black tabular-nums leading-none text-transparent bg-clip-text bg-gradient-to-b from-zinc-100 via-zinc-300 to-zinc-500 drop-shadow-[0_2px_8px_rgba(167,139,250,0.25)] sm:text-6xl"
          >
            {d}
          </div>
        ))}
      </div>
    </div>
  );
}