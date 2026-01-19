'use client';

import React, { useState, useCallback, useEffect } from 'react';

interface SessionEndedNotificationProps {
  onLeaveToDashboard: () => void;
  code?: string;
  codeSaved?: boolean;
  onTimeout?: () => void;
  countdownSeconds?: number;
}

const SessionEndedNotification: React.FC<SessionEndedNotificationProps> = ({
  onLeaveToDashboard,
  code = '',
  codeSaved = true,
  onTimeout,
  countdownSeconds = 30,
}) => {
  const [copySuccess, setCopySuccess] = useState(false);
  const [countdown, setCountdown] = useState(countdownSeconds);

  // Countdown timer effect
  useEffect(() => {
    if (!onTimeout) return;

    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          onTimeout();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [onTimeout]);

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
    <div
      className="absolute inset-0 bg-error-50/95 z-50 flex items-center justify-center"
      data-testid="session-ended-notification"
    >
      <div className="bg-white border-2 border-error-500 p-8 rounded-lg shadow-elevated max-w-lg w-full mx-4">
        <div className="flex flex-col gap-4">
          {/* Header row with icon and title */}
          <div className="flex items-center justify-center gap-3">
            <div className="flex-shrink-0">
              <svg className="h-8 w-8 text-error-500" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clipRule="evenodd" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-error-700">
              Session Ended
            </h2>
          </div>

          {/* Information messages */}
          <div className="space-y-2 text-center">
            <p className="text-base text-error-700">
              The instructor has ended this session.
            </p>
            {codeSaved && (
              <p className="text-sm text-error-600" data-testid="code-saved-message">
                Your code has been saved automatically.
              </p>
            )}
            <p className="text-sm text-error-600">
              You can no longer run code, but you can copy your work below.
            </p>
          </div>

          {/* Countdown message */}
          {onTimeout && (
            <p className="text-sm text-error-600 text-center font-medium" data-testid="countdown-message">
              Returning to sections in {countdown} seconds...
            </p>
          )}

          {/* Action buttons */}
          <div className="flex flex-wrap justify-center gap-3 mt-2">
            {code && (
              <button
                type="button"
                onClick={handleCopyCode}
                className={`inline-flex items-center px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                  copySuccess
                    ? 'text-success-700 bg-success-100'
                    : 'text-error-700 bg-error-100 hover:bg-error-200'
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
              className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-error-600 hover:bg-error-700 rounded-md transition-colors"
              data-testid="go-to-dashboard-button"
            >
              Go to Sections Now
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SessionEndedNotification;