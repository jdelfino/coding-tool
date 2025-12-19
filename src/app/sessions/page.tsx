'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useSessionHistory } from '@/hooks/useSessionHistory';
import SessionCard from './components/SessionCard';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

function SessionHistoryContent() {
  const { user, signOut } = useAuth();
  const { sessions, isLoading, error, reconnectToSession } = useSessionHistory();
  const router = useRouter();
  const [filter, setFilter] = useState<'all' | 'active' | 'completed'>('all');

  const handleSignOut = async () => {
    await signOut();
    router.push('/auth/signin');
  };

  const filteredSessions = sessions.filter(session => {
    if (filter === 'all') return true;
    return session.status === filter;
  });

  const activeSessions = sessions.filter(s => s.status === 'active');
  const completedSessions = sessions.filter(s => s.status === 'completed');

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">My Sessions</h1>
            <p className="text-sm text-gray-600 mt-1">
              {user?.username} ({user?.role})
            </p>
          </div>
          <button
            onClick={handleSignOut}
            className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Sign Out
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Summary Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-lg p-4 shadow-sm border">
            <div className="text-sm text-gray-600">Total Sessions</div>
            <div className="text-2xl font-bold">{sessions.length}</div>
          </div>
          <div className="bg-white rounded-lg p-4 shadow-sm border">
            <div className="text-sm text-gray-600">Active Sessions</div>
            <div className="text-2xl font-bold text-green-600">{activeSessions.length}</div>
          </div>
          <div className="bg-white rounded-lg p-4 shadow-sm border">
            <div className="text-sm text-gray-600">Completed Sessions</div>
            <div className="text-2xl font-bold text-gray-600">{completedSessions.length}</div>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="bg-white rounded-lg shadow-sm border mb-6">
          <div className="flex border-b">
            <button
              onClick={() => setFilter('all')}
              className={`px-6 py-3 text-sm font-medium border-b-2 ${
                filter === 'all'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              All Sessions ({sessions.length})
            </button>
            <button
              onClick={() => setFilter('active')}
              className={`px-6 py-3 text-sm font-medium border-b-2 ${
                filter === 'active'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              Active ({activeSessions.length})
            </button>
            <button
              onClick={() => setFilter('completed')}
              className={`px-6 py-3 text-sm font-medium border-b-2 ${
                filter === 'completed'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              Completed ({completedSessions.length})
            </button>
          </div>
        </div>

        {/* Session List */}
        {isLoading && (
          <div className="text-center py-12">
            <div className="text-gray-600">Loading sessions...</div>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-800">
            Error: {error}
          </div>
        )}

        {!isLoading && !error && filteredSessions.length === 0 && (
          <div className="text-center py-12">
            <div className="text-gray-600">
              {filter === 'all' 
                ? 'No sessions found'
                : `No ${filter} sessions found`}
            </div>
          </div>
        )}

        {!isLoading && !error && filteredSessions.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredSessions.map((session) => (
              <SessionCard
                key={session.id}
                session={session}
                onReconnect={reconnectToSession}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

export default function SessionHistoryPage() {
  return (
    <ProtectedRoute>
      <SessionHistoryContent />
    </ProtectedRoute>
  );
}
