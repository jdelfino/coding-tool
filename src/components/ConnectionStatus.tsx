'use client';

import React, { useState, useEffect, useCallback } from 'react';

export type ConnectionState = 'connected' | 'connecting' | 'disconnected' | 'failed';

export interface ConnectionStatusProps {
  /** Current connection status */
  status: ConnectionState;
  /** Optional error message to display */
  error?: string | null;
  /** Callback to attempt manual reconnection */
  onReconnect?: () => void;
  /** Whether reconnection is currently in progress */
  isReconnecting?: boolean;
  /** Current reconnection attempt number (1-indexed) */
  reconnectAttempt?: number;
  /** Maximum reconnection attempts before giving up */
  maxReconnectAttempts?: number;
  /** Time in ms when connection started (for timeout detection) */
  connectionStartTime?: number;
  /** Timeout threshold in ms (default: 10000) */
  timeoutThreshold?: number;
  /** Display style: 'badge' for compact header display, 'banner' for full-width notification */
  variant?: 'badge' | 'banner';
}

/**
 * ConnectionStatus component - displays connection state with actionable guidance
 *
 * Features:
 * - Visual indicator for each connection state
 * - Descriptive messages explaining current state
 * - Actionable guidance (e.g., "Click to reconnect")
 * - Reconnection attempt counter
 * - Timeout detection with guidance
 * - Manual reconnect button for failed state
 */
export function ConnectionStatus({
  status,
  error,
  onReconnect,
  isReconnecting = false,
  reconnectAttempt = 0,
  maxReconnectAttempts = 5,
  connectionStartTime,
  timeoutThreshold = 10000,
  variant = 'badge',
}: ConnectionStatusProps) {
  const [isTimedOut, setIsTimedOut] = useState(false);

  // Detect connection timeout
  useEffect(() => {
    if (status !== 'connecting' || !connectionStartTime) {
      setIsTimedOut(false);
      return;
    }

    const checkTimeout = () => {
      const elapsed = Date.now() - connectionStartTime;
      if (elapsed >= timeoutThreshold) {
        setIsTimedOut(true);
      }
    };

    // Check immediately and then set up interval
    checkTimeout();
    const interval = setInterval(checkTimeout, 1000);

    return () => clearInterval(interval);
  }, [status, connectionStartTime, timeoutThreshold]);

  const getStatusConfig = useCallback(() => {
    switch (status) {
      case 'connected':
        return {
          icon: <span aria-hidden="true" className="text-green-600">&#9679;</span>,
          label: 'Connected',
          description: null,
          bgColor: '#d4edda',
          textColor: '#155724',
          borderColor: '#c3e6cb',
        };
      case 'connecting':
        return {
          icon: <span aria-hidden="true" className="text-yellow-600">&#9675;</span>,
          label: isTimedOut ? 'Still connecting...' : 'Connecting...',
          description: isTimedOut
            ? 'Taking longer than expected. Check your internet connection.'
            : 'Please wait, establishing connection',
          bgColor: '#fff3cd',
          textColor: '#856404',
          borderColor: '#ffeaa7',
        };
      case 'disconnected':
        return {
          icon: <span aria-hidden="true" className="text-red-600">&#9679;</span>,
          label: 'Disconnected',
          description: reconnectAttempt > 0
            ? `Reconnecting (attempt ${reconnectAttempt} of ${maxReconnectAttempts})...`
            : 'Attempting to reconnect...',
          bgColor: '#f8d7da',
          textColor: '#721c24',
          borderColor: '#f5c6cb',
        };
      case 'failed':
        return {
          icon: <span aria-hidden="true" className="text-red-600">&#10005;</span>,
          label: 'Connection Failed',
          description: error || 'Check your internet connection and try again.',
          bgColor: '#f8d7da',
          textColor: '#721c24',
          borderColor: '#f5c6cb',
          showReconnect: true,
        };
      default:
        return {
          icon: null,
          label: 'Unknown',
          description: null,
          bgColor: '#e2e3e5',
          textColor: '#383d41',
          borderColor: '#d6d8db',
        };
    }
  }, [status, error, reconnectAttempt, maxReconnectAttempts, isTimedOut]);

  const config = getStatusConfig();

  if (variant === 'badge') {
    return (
      <div
        data-testid="connection-status"
        data-status={status}
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          padding: '0.5rem 1rem',
          backgroundColor: config.bgColor,
          borderRadius: '4px',
          fontSize: '0.9rem',
          gap: '0.25rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {config.icon}
          <span style={{ fontWeight: 500, color: config.textColor }}>
            {config.label}
          </span>
        </div>
        {config.description && (
          <span
            data-testid="connection-status-description"
            style={{
              fontSize: '0.75rem',
              color: config.textColor,
              opacity: 0.9,
            }}
          >
            {config.description}
          </span>
        )}
        {status === 'failed' && onReconnect && (
          <button
            onClick={onReconnect}
            disabled={isReconnecting}
            data-testid="reconnect-button"
            style={{
              marginTop: '0.25rem',
              padding: '0.25rem 0.5rem',
              fontSize: '0.75rem',
              backgroundColor: 'white',
              border: `1px solid ${config.borderColor}`,
              borderRadius: '3px',
              cursor: isReconnecting ? 'not-allowed' : 'pointer',
              color: config.textColor,
              opacity: isReconnecting ? 0.6 : 1,
            }}
          >
            {isReconnecting ? 'Reconnecting...' : 'Reconnect'}
          </button>
        )}
      </div>
    );
  }

  // Banner variant - full width notification
  return (
    <div
      data-testid="connection-status-banner"
      data-status={status}
      style={{
        padding: '0.75rem 1rem',
        backgroundColor: config.bgColor,
        borderRadius: '4px',
        border: `1px solid ${config.borderColor}`,
        marginBottom: '1rem',
      }}
    >
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '0.5rem',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          {config.icon}
          <div>
            <span style={{ fontWeight: 500, color: config.textColor }}>
              {config.label}
            </span>
            {config.description && (
              <p
                data-testid="connection-status-description"
                style={{
                  margin: '0.25rem 0 0 0',
                  fontSize: '0.875rem',
                  color: config.textColor,
                  opacity: 0.9,
                }}
              >
                {config.description}
              </p>
            )}
          </div>
        </div>
        {status === 'failed' && onReconnect && (
          <button
            onClick={onReconnect}
            disabled={isReconnecting}
            data-testid="reconnect-button"
            style={{
              padding: '0.5rem 1rem',
              fontSize: '0.875rem',
              backgroundColor: 'white',
              border: `1px solid ${config.borderColor}`,
              borderRadius: '4px',
              cursor: isReconnecting ? 'not-allowed' : 'pointer',
              color: config.textColor,
              fontWeight: 500,
              opacity: isReconnecting ? 0.6 : 1,
            }}
          >
            {isReconnecting ? 'Reconnecting...' : 'Reconnect'}
          </button>
        )}
      </div>
    </div>
  );
}

export default ConnectionStatus;
