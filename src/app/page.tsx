'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

export default function Home() {
  const router = useRouter();
  const { user, isLoading } = useAuth();

  // Redirect based on authentication and role
  useEffect(() => {
    if (!isLoading) {
      if (user) {
        // Redirect to appropriate page based on role
        const path = user.role === 'instructor' ? '/instructor' : '/student';
        router.push(path);
      } else {
        // Not authenticated, redirect to sign-in
        router.push('/auth/signin');
      }
    }
  }, [user, isLoading, router]);

  // Show loading while checking auth
  if (isLoading) {
    return (
      <main style={{ 
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <div style={{ fontSize: '1.2rem', color: '#666' }}>
          Loading...
        </div>
      </main>
    );
  }

  return null;
}
