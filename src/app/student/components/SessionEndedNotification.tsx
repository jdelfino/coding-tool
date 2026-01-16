'use client';

import React, { useState, useCallback } from 'react';

interface SessionEndedNotificationProps {
  onLeaveToDashboard: () => void;
  code?: string;
  codeSaved?: boolean;
}

const SessionEndedNotification: React.FC<SessionEndedNotificationProps> = ({
  onLeaveToDashboard,
  code = '',
  codeSaved = true,
}) => {
  const [copySuccess, setCopySuccess] = useState(false);

  const handleCopyCode = useCallback(async () => {
    if (!code) return;

    try {
      await navigator.clipboard.writeText(code);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (err) {
      // Fallback for browsers that don't support clipboard API
      const textArea = document.createElement('textarea');
      textArea.value = code;
      textArea.style.position = 'fixed';
      textArea.style.left = '-999999px';
      document.body.appendChild(textArea);
      textArea.select();
      try {
        document.execCommand('copy');
        setCopySuccess(true);
        setTimeout(() => setCopySuccess(false), 2000);
      } catch (fallbackErr) {
        console.error('Failed to copy code:', fallbackErr);
      }
      document.body.removeChild(textArea);
    }
  }, [code]);

  return (
    <div className="mb-4" data-testid="session-ended-notification">
      <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded-lg shadow-sm">
        <div className="flex flex-col gap-3">
          {/* Header row with icon and title */}
          <div className="flex items-start">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-yellow-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3 flex-1">
              <p className="text-sm font-medium text-yellow-800">
                Session Ended
              </p>
            </div>
          </div>

          {/* Information messages */}
          <div className="ml-8 space-y-2">
            <p className="text-sm text-yellow-700">
              The instructor has ended this session.
            </p>
            {codeSaved && (
              <p className="text-sm text-yellow-700" data-testid="code-saved-message">
                Your code has been saved automatically.
              </p>
            )}
            <p className="text-sm text-yellow-700">
              You can no longer run code, but you can copy your work below.
            </p>
          </div>

          {/* Action buttons */}
          <div className="ml-8 flex flex-wrap gap-2">
            {code && (
              <button
                type="button"
                onClick={handleCopyCode}
                className={`inline-flex items-center px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                  copySuccess
                    ? 'text-green-800 bg-green-100'
                    : 'text-yellow-800 bg-yellow-100 hover:bg-yellow-200'
                }`}
                data-testid="copy-code-button"
              >
                {copySuccess ? (
                  <>
                    <svg className="h-4 w-4 mr-1.5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    Copied!
                  </>
                ) : (
                  <>
                    <svg className="h-4 w-4 mr-1.5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                      <path d="M8 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z" />
                      <path d="M6 3a2 2 0 00-2 2v11a2 2 0 002 2h8a2 2 0 002-2V5a2 2 0 00-2-2 3 3 0 01-3 3H9a3 3 0 01-3-3z" />
                    </svg>
                    Copy Code
                  </>
                )}
              </button>
            )}
            <button
              type="button"
              onClick={onLeaveToDashboard}
              className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-yellow-800 bg-yellow-100 hover:bg-yellow-200 rounded-md transition-colors"
              data-testid="go-to-dashboard-button"
            >
              Go to Dashboard
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SessionEndedNotification;