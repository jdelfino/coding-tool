'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useClasses } from '@/hooks/useClasses';
import ClassList from './components/ClassList';
import CreateClassForm from './components/CreateClassForm';

export default function ClassesPage() {
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  const { classes, loading, fetchClasses, createClass } = useClasses();
  const [showCreateForm, setShowCreateForm] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/auth/signin');
      return;
    }

    if (user && user.role !== 'instructor') {
      router.push('/');
      return;
    }

    if (user) {
      fetchClasses();
    }
  }, [user, authLoading, router, fetchClasses]);

  const handleCreateClass = async (name: string, description: string) => {
    await createClass(name, description);
    setShowCreateForm(false);
  };

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-600">Loading...</div>
      </div>
    );
  }

  if (!user || user.role !== 'instructor') {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">My Classes</h1>
          {!showCreateForm && classes.length > 0 && (
            <button
              onClick={() => setShowCreateForm(true)}
              className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              <svg className="mr-2 h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              New Class
            </button>
          )}
        </div>

        {showCreateForm && (
          <div className="mb-8">
            <CreateClassForm
              onSubmit={handleCreateClass}
              onCancel={() => setShowCreateForm(false)}
            />
          </div>
        )}

        <ClassList 
          classes={classes} 
          onCreateNew={() => setShowCreateForm(true)} 
        />
      </div>
    </div>
  );
}
