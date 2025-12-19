import { SessionHistory } from '@/hooks/useSessionHistory';

interface SessionCardProps {
  session: SessionHistory;
  onReconnect: (sessionId: string) => void;
}

export default function SessionCard({ session, onReconnect }: SessionCardProps) {
  const isActive = session.status === 'active';
  const createdDate = new Date(session.createdAt);
  const lastActivityDate = new Date(session.lastActivity);

  return (
    <div className="border rounded-lg p-4 hover:shadow-md transition-shadow">
      <div className="flex justify-between items-start mb-2">
        <div className="flex-1">
          <h3 className="text-lg font-semibold">
            {session.problemText || 'Untitled Problem'}
          </h3>
          <div className="flex items-center gap-2 mt-1">
            <span
              className={`px-2 py-1 rounded text-xs font-medium ${
                isActive
                  ? 'bg-green-100 text-green-800'
                  : 'bg-gray-100 text-gray-800'
              }`}
            >
              {isActive ? 'Active' : 'Completed'}
            </span>
            <span className="text-sm text-gray-600">
              Code: {session.joinCode}
            </span>
          </div>
        </div>
      </div>

      <div className="text-sm text-gray-600 space-y-1 mb-3">
        <div>Created: {createdDate.toLocaleString()}</div>
        <div>Last Activity: {lastActivityDate.toLocaleString()}</div>
        {session.endedAt && (
          <div>Ended: {new Date(session.endedAt).toLocaleString()}</div>
        )}
        <div>Participants: {session.participantCount}</div>
      </div>

      <div className="flex gap-2">
        {isActive && (
          <button
            onClick={() => onReconnect(session.id)}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
          >
            Reconnect
          </button>
        )}
        <button
          onClick={() => onReconnect(session.id)}
          className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50 transition-colors"
        >
          {isActive ? 'View' : 'View Details'}
        </button>
      </div>
    </div>
  );
}
