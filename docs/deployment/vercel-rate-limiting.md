# Vercel WAF Rate Limiting

This guide covers configuring rate limiting for the application using Vercel's Web Application Firewall (WAF).

## Prerequisites

- Vercel Pro plan or above (WAF is not available on Hobby plan)
- Project deployed to Vercel

## Recommended Rate Limits

| Path Pattern | Limit | Window | Rationale |
|--------------|-------|--------|-----------|
| `/api/auth/register-student` | 10 | 1 min | Prevent registration spam |
| `/api/auth/accept-invite` | 5 | 1 min | Low volume, high security |
| `/api/sections/join` | 20 | 1 min | Higher for classroom scenarios |
| `/api/*/invitations` | 30 | 1 min | Admin operations |
| `/api/auth/*` | 20 | 1 min | General auth endpoints |

## Configuration Steps

1. Go to **Vercel Dashboard** → Your Project → **Firewall**
2. Navigate to the **Rate Limiting** tab
3. Click **Add Rule** for each pattern
4. Configure each rule:
   - **Path**: Enter the path pattern (e.g., `/api/auth/register-student`)
   - **Limit**: Number of requests allowed
   - **Window**: Time window (e.g., 1 minute)
   - **Action**: Select "Block" with 429 response

### Example Rule Configuration

```
Name: Student Registration Rate Limit
Path: /api/auth/register-student
Method: POST
Limit: 10 requests
Window: 60 seconds
Action: Block (429 Too Many Requests)
```

## How It Works

- Rate limits are evaluated **before** serverless function execution
- This means blocked requests don't incur function execution costs
- Limits are applied per IP address by default
- Vercel WAF uses fixed-window algorithm on Pro, token-bucket on Enterprise

## Pricing

- Approximately $0.50 per 1 million allowed requests
- Blocked requests are not charged
- Check current Vercel pricing for up-to-date costs

## Testing Rate Limits

1. Deploy your application to Vercel
2. Use a tool like `curl` or `hey` to send rapid requests:
   ```bash
   # Test with curl (run multiple times quickly)
   for i in {1..15}; do
     curl -X POST https://your-app.vercel.app/api/auth/register-student \
       -H "Content-Type: application/json" \
       -d '{"code":"TEST123"}' \
       -w "%{http_code}\n" -o /dev/null -s
   done
   ```
3. After exceeding the limit, you should receive 429 responses

## Alternative: Edge Middleware with Upstash

For more granular control (e.g., per-user limits, custom logic), consider using Edge Middleware with Upstash Redis:

### Setup

1. Install the package:
   ```bash
   npm install @upstash/ratelimit @upstash/redis
   ```

2. Create `middleware.ts`:
   ```typescript
   import { Ratelimit } from '@upstash/ratelimit';
   import { Redis } from '@upstash/redis';
   import { NextResponse } from 'next/server';
   import type { NextRequest } from 'next/server';

   const ratelimit = new Ratelimit({
     redis: Redis.fromEnv(),
     limiter: Ratelimit.slidingWindow(10, '1 m'),
   });

   export async function middleware(request: NextRequest) {
     const ip = request.ip ?? '127.0.0.1';
     const { success } = await ratelimit.limit(ip);

     if (!success) {
       return NextResponse.json(
         { error: 'Too many requests' },
         { status: 429 }
       );
     }

     return NextResponse.next();
   }

   export const config = {
     matcher: '/api/auth/:path*',
   };
   ```

3. Set environment variables:
   ```
   UPSTASH_REDIS_REST_URL=your-url
   UPSTASH_REDIS_REST_TOKEN=your-token
   ```

### When to Use Upstash vs Vercel WAF

| Feature | Vercel WAF | Upstash Middleware |
|---------|------------|-------------------|
| Setup complexity | Low (UI config) | Medium (code) |
| Per-user limits | No | Yes |
| Custom logic | No | Yes |
| Cost | ~$0.50/1M requests | Upstash pricing |
| Latency impact | Minimal | ~10-50ms |

**Recommendation:** Start with Vercel WAF for simplicity. Move to Upstash if you need per-user rate limiting or custom logic.

## Monitoring

1. **Vercel Dashboard** → Firewall → Analytics shows blocked requests
2. Set up alerts for unusual traffic patterns
3. Review logs periodically for attack attempts

## Troubleshooting

### Rate limits not working

1. Verify rules are enabled in Vercel Dashboard
2. Check path patterns match your API routes exactly
3. Ensure you're on Pro plan or above

### Legitimate users getting blocked

1. Increase limits for affected endpoints
2. Consider per-user limits with Upstash
3. Add IP allowlisting for known good actors (e.g., office IPs)

### 429 errors in development

- Rate limits only apply to production deployments
- Preview deployments may have different limits
- Local development (`localhost`) is not affected
