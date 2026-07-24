import { useEffect, useRef, useId } from 'react';

const SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY;
const SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js';

let scriptPromise = null;
function loadTurnstileScript() {
  if (window.turnstile) return Promise.resolve();
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = SCRIPT_SRC;
    script.async = true;
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });
  return scriptPromise;
}

// Renders a Cloudflare Turnstile CAPTCHA widget. Calls onVerify(token) once
// solved, and onExpire() if the token expires before the form is submitted.
// Renders nothing (and onVerify never fires) if VITE_TURNSTILE_SITE_KEY
// isn't configured, so the app still works before this is set up.
export default function Turnstile({ onVerify, onExpire }) {
  const containerRef = useRef(null);
  const widgetIdRef = useRef(null);
  const elementId = useId();

  useEffect(() => {
    if (!SITE_KEY) return;
    let cancelled = false;

    loadTurnstileScript().then(() => {
      if (cancelled || !containerRef.current) return;
      widgetIdRef.current = window.turnstile.render(containerRef.current, {
        sitekey: SITE_KEY,
        callback: (token) => onVerify?.(token),
        'expired-callback': () => onExpire?.(),
      });
    });

    return () => {
      cancelled = true;
      if (widgetIdRef.current != null && window.turnstile) {
        window.turnstile.remove(widgetIdRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!SITE_KEY) return null;
  return <div ref={containerRef} id={`turnstile-${elementId}`} />;
}
