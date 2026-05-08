// Simple in-memory rate limiter. Per-instance only — for multi-instance
// production, replace with Upstash or Redis. Sufficient for a single
// Vercel function instance or a self-hosted single-process deployment.
const buckets = new Map<string, { count: number; resetAt: number }>();

// Sweep stale buckets every 5 minutes so the map doesn't grow unbounded.
let lastSweep = Date.now();
function maybeSweep() {
  if (Date.now() - lastSweep < 5 * 60 * 1000) return;
  const now = Date.now();
  for (const [k, v] of buckets) if (v.resetAt < now) buckets.delete(k);
  lastSweep = now;
}

export function rateLimit(
  key: string,
  max: number,
  windowMs: number,
): { ok: true } | { ok: false; retryAfterSeconds: number } {
  maybeSweep();
  const now = Date.now();
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true };
  }
  if (bucket.count >= max) {
    return { ok: false, retryAfterSeconds: Math.ceil((bucket.resetAt - now) / 1000) };
  }
  bucket.count++;
  return { ok: true };
}

export function clientIp(request: Request): string {
  const xff = request.headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0].trim();
  return request.headers.get('x-real-ip') || 'unknown';
}
