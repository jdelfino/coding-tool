'use client';

import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import CreateSessionFromProblemModal from '@/app/(app)/instructor/components/CreateSessionFromProblemModal';

interface InstructorActionsProps {
  problemId: string;
  problemTitle: string;
}

export default function InstructorActions({ problemId, problemTitle }: InstructorActionsProps) {
  const { user, isLoading } = useAuth();
  const [showModal, setShowModal] = useState(false);
  const router = useRouter();

  if (isLoading) return null;

  const isInstructor = user && ['instructor', 'namespace-admin', 'system-admin'].includes(user.role);
  if (!isInstructor) return null;

  return (
    <>
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => setShowModal(true)}
          className="px-4 py-2 text-sm bg-blue-600 text-white hover:bg-blue-700 rounded-lg transition-colors"
        >
          Start Session
        </button>
      </div>
      {showModal && (
        <CreateSessionFromProblemModal
          problemId={problemId}
          problemTitle={problemTitle}
          onClose={() => setShowModal(false)}
          onSuccess={(sessionId) => {
            setShowModal(false);
            router.push(`/instructor/session/${sessionId}`);
          }}
        />
      )}
    </>
  );
}
