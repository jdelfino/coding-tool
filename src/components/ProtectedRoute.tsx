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
  allowAdmin?: boolean; // Allow admins to access this route even if requiredRole is different
}

export function ProtectedRoute({
  children,
  requiredRole,
  fallbackPath = '/auth/signin',
  allowAdmin = true, // Default to allowing admins
}: ProtectedRouteProps) {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading) {
      if (!user) {
        // Not authenticated, redirect to sign-in
        router.push(fallbackPath);
      } else if (requiredRole) {
        // Check if user has required role or is admin (if allowed)
        const hasAccess = user.role === requiredRole || (allowAdmin && user.role === 'admin');
        if (!hasAccess) {
          // Wrong role, redirect to appropriate page
          const defaultPath = user.role === 'instructor' ? '/instructor' : '/student';
          router.push(defaultPath);
        }
      }
    }
  }, [user, isLoading, requiredRole, router, fallbackPath, allowAdmin]);

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
  if (requiredRole) {
    const hasAccess = user.role === requiredRole || (allowAdmin && user.role === 'admin');
    if (!hasAccess) {
      return null;
    }
  }

  return <>{children}</>;
}
