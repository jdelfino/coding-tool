import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

const isProduction = process.env.NODE_ENV === 'production';
const isCI = !!process.env.CI;

// Validate rate limiting is configured in production (but allow CI without it for E2E tests)
if (isProduction && !isCI && !process.env.UPSTASH_REDIS_REST_URL) {
  throw new Error(
    'FATAL: Rate limiting is required in production but UPSTASH_REDIS_REST_URL is not set. ' +
    'Configure Upstash Redis or set NODE_ENV to development.'
  );
}

// Initialize Redis client (null in dev if not configured)
const redis = process.env.UPSTASH_REDIS_REST_URL
  ? new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    })
  : null;

// Log warning in dev/CI mode without Redis
if ((!isProduction || isCI) && !redis) {
  console.warn('[rate-limit] Redis not configured - rate limiting disabled in development/CI');
}

// Rate limit categories by risk/cost
export const RateLimiters = {
  // Auth routes - IP-based, strict limit for brute force prevention
  auth: redis ? new Ratelimit({
    redis,
    limiter: Ratelimit.fixedWindow(5, '1 m'),
    prefix: 'rl:auth',
  }) : null,

  // Join routes - IP-based, moderate limit for join code brute force
  join: redis ? new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(10, '1 m'),
    prefix: 'rl:join',
  }) : null,

  // Execute routes - User-based, resource intensive
  execute: redis ? new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(30, '1 m'),
    prefix: 'rl:execute',
  }) : null,

  // Trace route - User-based, very resource intensive
  trace: redis ? new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(10, '1 m'),
    prefix: 'rl:trace',
  }) : null,

  // Analyze route - User-based, external API cost
  analyze: redis ? new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(5, '1 m'),
    prefix: 'rl:analyze',
  }) : null,

  // Write operations - User-based, create/update/delete
  write: redis ? new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(30, '1 m'),
    prefix: 'rl:write',
  }) : null,

  // Read operations - User-based, general API access
  read: redis ? new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(100, '1 m'),
    prefix: 'rl:read',
  }) : null,
};

export type RateLimitCategory = keyof typeof RateLimiters;

export interface RateLimitResult {
  success: boolean;
  limited: boolean;
  remaining?: number;
  reset?: number;
}

/**
 * Check rate limit for a given category and key
 */
export async function checkRateLimit(
  category: RateLimitCategory,
  key: string
): Promise<RateLimitResult> {
  const limiter = RateLimiters[category];
  if (!limiter) {
    // In dev/CI without Redis - allow request but log warning
    if (!isProduction || isCI) {
      console.warn(`[rate-limit] Skipping rate limit for ${category} - Redis not configured (dev/CI mode)`);
      return { success: true, limited: false };
    }
    // Should never reach here in prod due to startup check
    throw new Error(`Rate limiter ${category} not available in production`);
  }
  const { success, remaining, reset } = await limiter.limit(key);
  return { success, limited: !success, remaining, reset };
}

/**
 * Extract client IP from request headers
 */
export function getClientIP(request: Request): string {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    ?? request.headers.get('x-real-ip')
    ?? 'unknown';
}

/**
 * Get rate limit key - user ID if authenticated, IP otherwise
 */
export function getRateLimitKey(request: Request, userId?: string): string {
  if (userId) return `user:${userId}`;
  return `ip:${getClientIP(request)}`;
}

/**
 * Create a 429 Too Many Requests response
 */
export function rateLimitResponse(result: RateLimitResult): Response {
  const retryAfter = result.reset
    ? Math.ceil((result.reset - Date.now()) / 1000)
    : 60;

  return new Response(
    JSON.stringify({ error: 'Too many requests. Please try again later.' }),
    {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'X-RateLimit-Remaining': String(result.remaining ?? 0),
        'Retry-After': String(Math.max(1, retryAfter)),
      },
    }
  );
}

/**
 * Check rate limit and return 429 Response if limited, null otherwise.
 *
 * Usage:
 * ```typescript
 * // For unauthenticated routes (IP-based):
 * const limited = await rateLimit('auth', request);
 * if (limited) return limited;
 *
 * // For authenticated routes (user-based):
 * const limited = await rateLimit('execute', request, user.id);
 * if (limited) return limited;
 * ```
 */
export async function rateLimit(
  category: RateLimitCategory,
  request: Request,
  userId?: string
): Promise<Response | null> {
  const key = getRateLimitKey(request, userId);
  const result = await checkRateLimit(category, key);
  return result.limited ? rateLimitResponse(result) : null;
}

/**
 * Check if rate limiting is enabled (useful for testing/diagnostics)
 */
export function isRateLimitingEnabled(): boolean {
  return redis !== null;
}
