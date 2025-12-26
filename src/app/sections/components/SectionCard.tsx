'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import type { Session } from '@/server/types';

interface SectionWithClass {
  id: string;
  classId: string;
  name: string;
  semester?: string;
  className: string;
  classDescription: string;
  role: 'instructor' | 'student';
  instructorIds: string[];
  joinCode: string;
  createdAt: string | Date;
}

interface SectionCardProps {
  section: SectionWithClass;
  getActiveSessions: (sectionId: string) => Promise<Session[]>;
}

export default function SectionCard({ section, getActiveSessions }: SectionCardProps) {
  const router = useRouter();
  const [activeSessions, setActiveSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadActiveSessions();
    // Poll for active sessions every 30 seconds
    const interval = setInterval(loadActiveSessions, 30000);
    return () => clearInterval(interval);
  }, [section.id]);

  const loadActiveSessions = async () => {
    try {
      const sessions = await getActiveSessions(section.id);
      setActiveSessions(sessions);
    } catch (error) {
      console.error('Failed to load active sessions:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleJoinSession = (sessionId: string) => {
    router.push(`/student?sessionId=${sessionId}`);
  };

  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 p-4 text-white">
        <h3 className="text-lg font-semibold">{section.name}</h3>
        {section.semester && (
          <p className="text-blue-100 text-sm">{section.semester}</p>
        )}
      </div>

      {/* Body */}
      <div className="p-4 space-y-4">
        {/* Class Info */}
        <div>
          <h4 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-1">
            Class
          </h4>
          <p className="text-gray-900 font-medium">{section.className}</p>
        </div>

        {/* Active Sessions */}
        {loading ? (
          <div className="text-sm text-gray-500">Loading sessions...</div>
        ) : activeSessions.length > 0 ? (
          <div className="border-t pt-4">
            <div className="flex items-center mb-3">
              <div className="flex-shrink-0 w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
              <h4 className="ml-2 text-sm font-medium text-gray-700">
                Active Session{activeSessions.length > 1 ? 's' : ''}
              </h4>
            </div>
            <div className="space-y-2">
              {activeSessions.map((session) => (
                <div 
                  key={session.id} 
                  className="flex items-center justify-between bg-green-50 border border-green-200 p-3 rounded"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {session.problem?.title || 'Coding Session'}
                    </p>
                    <p className="text-xs text-gray-500">
                      {session.students?.size || 0} student{session.students?.size !== 1 ? 's' : ''} joined
                    </p>
                  </div>
                  <button
                    onClick={() => handleJoinSession(session.id)}
                    className="ml-3 px-4 py-2 bg-green-600 text-white text-sm font-medium rounded hover:bg-green-700"
                  >
                    Join Now
                  </button>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="border-t pt-4">
            <p className="text-sm text-gray-500">No active sessions</p>
          </div>
        )}

        {/* Footer Stats */}
        <div className="border-t pt-4 text-sm text-gray-600">
          <p>Enrolled as {section.role}</p>
        </div>
      </div>
    </div>
  );
}
