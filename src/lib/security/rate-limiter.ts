/**
 * teachAI Rate Limiter
 * ─────────────────────────────────────────────────────────────
 * In-memory sliding window rate limiter for API protection.
 * Supports per-IP and per-API-key throttling.
 *
 * Production upgrade path: Replace with Redis-backed limiter
 * (e.g., @upstash/ratelimit) for multi-instance deployments.
 */

interface RateLimitEntry {
  timestamps: number[];
  blocked_until: number;
}

const store = new Map<string, RateLimitEntry>();

const CLEANUP_INTERVAL = 60_000;
let lastCleanup = Date.now();

function cleanup(windowMs: number) {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL) return;
  lastCleanup = now;
  const cutoff = now - windowMs * 2;
  for (const [key, entry] of store) {
    if (entry.timestamps.length === 0 && entry.blocked_until < now) {
      store.delete(key);
    } else {
      entry.timestamps = entry.timestamps.filter((t) => t > cutoff);
      if (entry.timestamps.length === 0 && entry.blocked_until < now) {
        store.delete(key);
      }
    }
  }
}

export interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  blockDurationMs?: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
  retryAfterMs?: number;
}

export const RATE_LIMITS = {
  api: { windowMs: 60_000, maxRequests: 30, blockDurationMs: 30_000 },
  auth: { windowMs: 300_000, maxRequests: 10, blockDurationMs: 600_000 },
  ingest: { windowMs: 60_000, maxRequests: 10, blockDurationMs: 30_000 },
  teach: { windowMs: 60_000, maxRequests: 20, blockDurationMs: 15_000 },
  score: { windowMs: 60_000, maxRequests: 15, blockDurationMs: 15_000 },
} as const;

export function checkRateLimit(
  key: string,
  config: RateLimitConfig
): RateLimitResult {
  const now = Date.now();
  cleanup(config.windowMs);

  let entry = store.get(key);
  if (!entry) {
    entry = { timestamps: [], blocked_until: 0 };
    store.set(key, entry);
  }

  if (entry.blocked_until > now) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: entry.blocked_until,
      retryAfterMs: entry.blocked_until - now,
    };
  }

  const windowStart = now - config.windowMs;
  entry.timestamps = entry.timestamps.filter((t) => t > windowStart);

  if (entry.timestamps.length >= config.maxRequests) {
    entry.blocked_until = now + (config.blockDurationMs ?? config.windowMs);
    return {
      allowed: false,
      remaining: 0,
      resetAt: entry.blocked_until,
      retryAfterMs: entry.blocked_until - now,
    };
  }

  entry.timestamps.push(now);
  const remaining = config.maxRequests - entry.timestamps.length;
  const oldestInWindow = entry.timestamps[0] ?? now;
  const resetAt = oldestInWindow + config.windowMs;

  return { allowed: true, remaining, resetAt };
}

export function getRateLimitHeaders(result: RateLimitResult): Record<string, string> {
  const headers: Record<string, string> = {
    "X-RateLimit-Remaining": String(result.remaining),
    "X-RateLimit-Reset": new Date(result.resetAt).toUTCString(),
  };
  if (!result.allowed && result.retryAfterMs) {
    headers["Retry-After"] = String(Math.ceil(result.retryAfterMs / 1000));
  }
  return headers;
}
