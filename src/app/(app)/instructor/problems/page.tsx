'use client';

/**
 * Instructor Problems Page - Redirect to main instructor page
 * 
 * This page redirects to /instructor with the problems view active.
 * The problems functionality is embedded in the main instructor page.
 */

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function ProblemsRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to main instructor page
    // The problems view will be shown via the navigation tabs
    router.replace('/instructor');
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div 
          className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-4"
          role="status"
          aria-label="Loading"
        ></div>
        <p className="text-gray-600">Redirecting to instructor dashboard...</p>
      </div>
    </div>
  );
}
