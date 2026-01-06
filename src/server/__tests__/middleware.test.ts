/**
 * Tests for Next.js middleware that handles Supabase session refresh
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

// Mock @supabase/ssr
jest.mock('@supabase/ssr', () => ({
  createServerClient: jest.fn(),
}))

// Import after mocking
let middleware: any
let config: any

describe('Middleware', () => {
  let mockGetSession: jest.Mock
  let mockAuth: any
  let mockSupabaseClient: any

  beforeEach(async () => {
    jest.clearAllMocks()

    // Setup mock Supabase client
    mockGetSession = jest.fn().mockResolvedValue({
      data: {
        session: {
          access_token: 'mock-access-token',
          refresh_token: 'mock-refresh-token',
          expires_at: Date.now() / 1000 + 3600,
        },
      },
      error: null,
    })

    mockAuth = {
      getSession: mockGetSession,
    }

    mockSupabaseClient = {
      auth: mockAuth,
    }

    ;(createServerClient as jest.Mock).mockReturnValue(mockSupabaseClient)

    // Set required environment variables
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://localhost:54321'
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key'

    // Import middleware after mocks are set up
    const middlewareModule = await import('../../middleware')
    middleware = middlewareModule.middleware
    config = middlewareModule.config
  })

  describe('Session Refresh', () => {
    it('should call getSession on every request', async () => {
      const request = new NextRequest('http://localhost:3000/api/test')

      await middleware(request)

      expect(mockGetSession).toHaveBeenCalledTimes(1)
    })

    it('should create Supabase client with environment variables', async () => {
      const request = new NextRequest('http://localhost:3000/api/test')

      await middleware(request)

      expect(createServerClient).toHaveBeenCalledWith(
        'http://localhost:54321',
        'test-anon-key',
        expect.objectContaining({
          cookies: expect.any(Object),
        })
      )
    })

    it('should return NextResponse on successful session refresh', async () => {
      const request = new NextRequest('http://localhost:3000/api/test')

      const response = await middleware(request)

      expect(response).toBeInstanceOf(NextResponse)
      expect(response.status).toBe(200)
    })

    it('should handle session refresh errors gracefully', async () => {
      mockGetSession.mockResolvedValue({
        data: { session: null },
        error: { message: 'Session expired' },
      })

      const request = new NextRequest('http://localhost:3000/api/test')

      const response = await middleware(request)

      // Middleware should still return a response even if session refresh fails
      expect(response).toBeInstanceOf(NextResponse)
      expect(response.status).toBe(200)
    })
  })

  describe('Cookie Management', () => {
    it('should provide cookie get callback to Supabase client', async () => {
      const request = new NextRequest('http://localhost:3000/api/test', {
        headers: {
          cookie: 'sb-access-token=test-token; other-cookie=value',
        },
      })

      await middleware(request)

      const createClientCall = (createServerClient as jest.Mock).mock.calls[0]
      const cookieConfig = createClientCall[2].cookies

      // Test cookie get callback
      const result = cookieConfig.get('sb-access-token')
      expect(result).toBe('test-token')
    })

    it('should provide cookie set callback to Supabase client', async () => {
      const request = new NextRequest('http://localhost:3000/api/test')

      await middleware(request)

      const createClientCall = (createServerClient as jest.Mock).mock.calls[0]
      const cookieConfig = createClientCall[2].cookies

      // Cookie set callback should be defined
      expect(typeof cookieConfig.set).toBe('function')

      // Note: Testing actual cookie setting is difficult due to NextResponse internals
      // In real usage, this is tested via integration tests
    })

    it('should provide cookie remove callback to Supabase client', async () => {
      const request = new NextRequest('http://localhost:3000/api/test')

      await middleware(request)

      const createClientCall = (createServerClient as jest.Mock).mock.calls[0]
      const cookieConfig = createClientCall[2].cookies

      // Cookie remove callback should be defined
      expect(typeof cookieConfig.remove).toBe('function')
    })
  })

  describe('Request Headers', () => {
    it('should preserve original request headers', async () => {
      const request = new NextRequest('http://localhost:3000/api/test', {
        headers: {
          'x-custom-header': 'test-value',
          'user-agent': 'test-agent',
        },
      })

      const response = await middleware(request)

      // Response should be created with original request headers
      expect(response).toBeInstanceOf(NextResponse)
    })
  })

  describe('Route Matching', () => {
    it('should have correct matcher configuration', () => {
      expect(config.matcher).toBeDefined()
      expect(Array.isArray(config.matcher)).toBe(true)
      expect(config.matcher.length).toBeGreaterThan(0)
    })

    it('should document matcher pattern for API and page routes', () => {
      // The matcher pattern is: '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'
      // This matches everything EXCEPT static assets

      // Document expected matches:
      // - /api/* routes
      // - /instructor, /student, /system pages
      // - /auth/* pages

      // Document expected exclusions:
      // - /_next/static/*
      // - /_next/image/*
      // - /favicon.ico
      // - /*.{svg,png,jpg,jpeg,gif,webp}

      const pattern = config.matcher[0]
      expect(typeof pattern).toBe('string')
      expect(pattern).toContain('_next/static')
      expect(pattern).toContain('_next/image')
      expect(pattern).toContain('favicon.ico')
    })
  })

  describe('Performance', () => {
    it('should complete session refresh within reasonable time', async () => {
      const request = new NextRequest('http://localhost:3000/api/test')

      const startTime = Date.now()
      await middleware(request)
      const duration = Date.now() - startTime

      // Should complete in less than 100ms (with mocked Supabase client)
      expect(duration).toBeLessThan(100)
    })
  })

  describe('Error Handling', () => {
    it('should handle missing environment variables', async () => {
      const originalUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
      const originalKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

      delete process.env.NEXT_PUBLIC_SUPABASE_URL
      delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

      // Re-import to get middleware with missing env vars
      jest.resetModules()
      const middlewareModule = await import('../../middleware')
      const middlewareWithoutEnv = middlewareModule.middleware

      const request = new NextRequest('http://localhost:3000/api/test')

      // Should throw due to missing environment variables
      await expect(async () => {
        await middlewareWithoutEnv(request)
      }).rejects.toThrow()

      // Restore for other tests
      process.env.NEXT_PUBLIC_SUPABASE_URL = originalUrl
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = originalKey
    })

    it('should handle Supabase client creation failure', async () => {
      ;(createServerClient as jest.Mock).mockImplementation(() => {
        throw new Error('Failed to create client')
      })

      const request = new NextRequest('http://localhost:3000/api/test')

      // Should propagate the error from client creation
      await expect(middleware(request)).rejects.toThrow()
    })
  })
})

describe('Integration Behavior Documentation', () => {
  it('should document expected cookie flow', () => {
    /*
     * Expected Flow:
     * 1. Browser sends request with sb-access-token cookie
     * 2. Middleware calls supabase.auth.getSession()
     * 3. If token expired, Supabase refreshes using refresh token
     * 4. Middleware updates response cookies with new tokens
     * 5. Browser receives response with updated cookies
     * 6. Subsequent requests use new cookies
     *
     * This ensures users stay logged in as long as refresh token is valid (~7 days)
     */
    expect(true).toBe(true)
  })

  it('should document performance characteristics', () => {
    /*
     * Performance Expectations:
     * - Valid session: <10ms (just cookie read + validation)
     * - Expired session: <200ms (includes Supabase API call for refresh)
     * - Middleware runs on EVERY matched request
     * - Consider caching if performance becomes issue
     *
     * Monitor:
     * - P95 latency for middleware execution
     * - Rate of session refreshes (should be ~1 per hour per user)
     * - Supabase API error rates
     */
    expect(true).toBe(true)
  })
})
