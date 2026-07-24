import { useRef, useEffect } from 'react';

const DIGITS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 0]; // duplicate 0 for seamless wrap
const DIGIT_H = 4; // rem (matches h-16)
const STRIP_H = 40; // 10 digits × 4rem

export default function DigitReel({ targetDigit, spinId, stopDelay, index = 0 }) {
  const stripRef = useRef(null);
  const rafRef = useRef(null);

  useEffect(() => {
    const strip = stripRef.current;
    if (!strip) return;

    // Initial mount (no spin yet) — show target digit
    if (spinId === 0) {
      strip.style.transition = 'none';
      strip.style.transform = `translateY(-${targetDigit * DIGIT_H}rem)`;
      return;
    }

    // Start spinning
    strip.style.transition = 'none';
    const startTime = performance.now();
    const SPIN_SPEED = 72; // rem per second
    let currentY = 0;
    let snapTimer = null;

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
    };
  }, [spinId]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div
      className="group relative h-16 w-11 overflow-hidden rounded-xl border border-zinc-700/80 bg-gradient-to-b from-zinc-900 via-zinc-950 to-zinc-900 shadow-lg shadow-violet-500/10 ring-1 ring-white/5 sm:w-12"
      style={{ animationDelay: `${index * 60}ms` }}
    >
      {/* Glow accent */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-violet-500/5 to-transparent" />
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