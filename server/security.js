const buckets = new Map();

// Small, dependency-free rate limiter. It is per running server instance;
// use Cloudflare rate limiting as the outer, network-level protection.
export function rateLimit({ windowMs, max, key = (req) => req.ip }) {
  return (req, res, next) => {
    const now = Date.now();
    const bucketKey = key(req);
    const bucket = buckets.get(bucketKey) || [];
    const recent = bucket.filter((time) => now - time < windowMs);
    if (recent.length >= max) {
      res.set('Retry-After', String(Math.ceil((windowMs - (now - recent[0])) / 1000)));
      return res.status(429).json({ message: 'Too many requests. Please try again later.' });
    }
    recent.push(now);
    buckets.set(bucketKey, recent);
    next();
  };
}

export function securityHeaders(_req, res, next) {
  res.set({
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
    'Cross-Origin-Resource-Policy': 'same-origin',
    // Defense-in-depth against XSS: even if a malicious script somehow got
    // injected, the browser refuses to run it unless it matches this policy.
    'Content-Security-Policy': [
      "default-src 'self'",
      "script-src 'self' https://challenges.cloudflare.com",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https:",
      "frame-src https://challenges.cloudflare.com",
      "connect-src 'self' https://*.pusher.com wss://*.pusher.com https://challenges.cloudflare.com",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join('; '),
  });
  next();
}
