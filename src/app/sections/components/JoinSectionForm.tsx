'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface JoinSectionFormProps {
  onSubmit: (joinCode: string) => Promise<void>;
}

export default function JoinSectionForm({ onSubmit }: JoinSectionFormProps) {
  const router = useRouter();
  const [joinCode, setJoinCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinCode.trim()) {
      setError('Join code is required');
      return;
    }

    setSubmitting(true);
    setError(null);
    setSuccess(false);

    try {
      await onSubmit(joinCode.trim());
      setSuccess(true);
      setJoinCode('');

      // Redirect to sections dashboard after a brief delay
      setTimeout(() => {
        router.push('/sections');
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to join section');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-md mx-auto">
      <form onSubmit={handleSubmit} className="bg-white p-8 rounded-lg shadow-md space-y-6">
        <div className="text-center">
          <h2 className="text-3xl font-bold text-gray-900 mb-2">Join a Section</h2>
          <p className="text-gray-600">Enter the join code provided by your instructor</p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
            {error}
          </div>
        )}

        {success && (
          <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded">
            Successfully joined section! Redirecting...
          </div>
        )}

        <div>
          <label htmlFor="joinCode" className="block text-sm font-medium text-gray-700 mb-2">
            Join Code
          </label>
          <input
            id="joinCode"
            type="text"
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
            placeholder="e.g., ABC123"
            className="w-full px-4 py-3 text-lg font-mono border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-center tracking-wider"
            disabled={submitting || success}
            required
            maxLength={6}
          />
          <p className="mt-2 text-sm text-gray-500">
            Enter the 6-character code from your instructor
          </p>
        </div>

        <button
          type="submit"
          disabled={submitting || !joinCode.trim() || success}
          className="w-full py-3 bg-blue-600 text-white font-semibold rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {submitting ? 'Joining...' : success ? 'Joined!' : 'Join Section'}
        </button>

        <div className="border-t pt-4">
          <p className="text-sm text-gray-600">
            After joining, you'll see this section in your dashboard and can participate in coding sessions.
          </p>
        </div>

        <button
          type="button"
          onClick={() => router.push('/sections')}
          className="w-full text-center text-blue-600 hover:text-blue-700 text-sm"
        >
          ← Back to My Sections
        </button>
      </form>
    </div>
  );
}
