'use client';

/**
 * Protected route wrapper.
 * Redirects to sign-in if not authenticated.
 * Optionally checks for specific roles.
 */

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import type { UserRole } from '@/server/auth/types';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: UserRole;
  fallbackPath?: string;
}

export function ProtectedRoute({
  children,
  requiredRole,
  fallbackPath = '/auth/signin',
}: ProtectedRouteProps) {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading) {
      if (!user) {
        // Not authenticated, redirect to sign-in
        router.push(fallbackPath);
      } else if (requiredRole && user.role !== requiredRole) {
        // Wrong role, redirect to appropriate page
        const defaultPath = user.role === 'instructor' ? '/instructor' : '/student';
        router.push(defaultPath);
      }
    }
  }, [user, isLoading, requiredRole, router, fallbackPath]);

  // Show loading state while checking authentication
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg text-gray-600">Loading...</div>
      </div>
    );
  }

  // Don't render children until authenticated
  if (!user) {
    return null;
  }

  // SECURITY FIX: Check role BEFORE rendering children
  // This prevents unauthorized users from seeing protected content
  // even briefly before the redirect completes
  if (requiredRole && user.role !== requiredRole) {
    return null;
  }

  return <>{children}</>;
}
