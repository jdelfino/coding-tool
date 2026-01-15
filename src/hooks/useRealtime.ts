'use client';

import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { RealtimeChannel, REALTIME_SUBSCRIBE_STATES } from '@supabase/supabase-js';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';

export interface RealtimeMessage {
  type: 'INSERT' | 'UPDATE' | 'DELETE';
  table: string;
  payload: any;
}

export type ConnectionStatus = 'connected' | 'connecting' | 'disconnected' | 'failed';

export interface PresenceState {
  [key: string]: any;
}

export interface UseRealtimeOptions {
  /** Session ID to subscribe to */
  sessionId: string;
  /** User ID for presence tracking */
  userId?: string;
  /** Additional presence data */
  presenceData?: Record<string, any>;
  /** Tables to subscribe to (defaults to session_students, sessions, revisions) */
  tables?: string[];
  /** Maximum reconnection attempts before giving up (default: 5) */
  maxReconnectAttempts?: number;
}

const DEFAULT_TABLES = ['session_students', 'sessions', 'revisions'];
const DEFAULT_MAX_RECONNECT_ATTEMPTS = 5;

/**
 * Low-level hook for Supabase Realtime subscriptions
 *
 * Handles:
 * - Real-time subscriptions to database changes
 * - Presence tracking (who's online)
 * - Connection management with auto-reconnect
 * - Error handling
 */
export function useRealtime({
  sessionId,
  userId,
  presenceData = {},
  tables = DEFAULT_TABLES,
  maxReconnectAttempts = DEFAULT_MAX_RECONNECT_ATTEMPTS,
}: UseRealtimeOptions) {
  const [isConnected, setIsConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected');
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [lastMessage, setLastMessage] = useState<RealtimeMessage | null>(null);
  const [onlineUsers, setOnlineUsers] = useState<PresenceState>({});
  const [reconnectAttempt, setReconnectAttempt] = useState(0);
  const [connectionStartTime, setConnectionStartTime] = useState<number | null>(null);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [reconnectKey, setReconnectKey] = useState(0);

  const channelRef = useRef<RealtimeChannel | null>(null);
  const supabaseRef = useRef(getSupabaseBrowserClient());
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Stabilize tables and presenceData to prevent unnecessary reconnections
  // when callers pass new object/array references with the same content
  const tablesKey = useMemo(() => JSON.stringify(tables.slice().sort()), [tables]);
  const presenceDataKey = useMemo(() => JSON.stringify(presenceData), [presenceData]);
  const tablesRef = useRef(tables);
  const presenceDataRef = useRef(presenceData);

  // Update refs when content actually changes
  useEffect(() => {
    tablesRef.current = tables;
  }, [tablesKey]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    presenceDataRef.current = presenceData;
  }, [presenceDataKey]); // eslint-disable-line react-hooks/exhaustive-deps

  /**
   * Handle postgres_changes events
   */
  const handleDatabaseChange = useCallback((payload: any) => {
    const message: RealtimeMessage = {
      type: payload.eventType as 'INSERT' | 'UPDATE' | 'DELETE',
      table: payload.table,
      payload: payload.new || payload.old,
    };
    setLastMessage(message);
  }, []);

  /**
   * Handle presence sync events
   */
  const handlePresenceSync = useCallback((channel: RealtimeChannel) => {
    const presenceState = channel.presenceState();
    setOnlineUsers(presenceState);
  }, []);

  /**
   * Setup Realtime subscriptions
   */
  useEffect(() => {
    if (!sessionId) {
      return;
    }

    const supabase = supabaseRef.current;
    setConnectionStatus('connecting');
    setConnectionError(null);
    setConnectionStartTime(Date.now());

    // Create channel for this session
    const channel = supabase.channel(`session:${sessionId}`, {
      config: {
        presence: {
          key: userId || 'anonymous',
        },
      },
    });

    // Subscribe to postgres_changes for each table (use ref for stable reference)
    tablesRef.current.forEach((table) => {
      // The sessions table uses 'id', other tables use 'session_id'
      const filterColumn = table === 'sessions' ? 'id' : 'session_id';
      channel.on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table,
          filter: `${filterColumn}=eq.${sessionId}`,
        },
        handleDatabaseChange
      );
    });

    // Subscribe to presence events
    if (userId) {
      channel
        .on('presence', { event: 'sync' }, () => handlePresenceSync(channel))
        .on('presence', { event: 'join' }, () => handlePresenceSync(channel))
        .on('presence', { event: 'leave' }, () => handlePresenceSync(channel));
    }

    // Subscribe to channel
    channel
      .subscribe(async (status) => {
        if (status === REALTIME_SUBSCRIBE_STATES.SUBSCRIBED) {
          setIsConnected(true);
          setConnectionStatus('connected');
          setConnectionError(null);
          setReconnectAttempt(0);
          setIsReconnecting(false);
          setConnectionStartTime(null);

          // Track presence if userId provided (use ref for stable reference)
          if (userId) {
            const trackStatus = await channel.track({
              user_id: userId,
              online_at: new Date().toISOString(),
              ...presenceDataRef.current,
            });

            if (trackStatus !== 'ok') {
              console.error('[Realtime] Failed to track presence:', trackStatus);
            }
          }
        } else if (status === REALTIME_SUBSCRIBE_STATES.CHANNEL_ERROR) {
          setIsConnected(false);
          setConnectionStatus('failed');
          setConnectionError('Failed to connect to real-time server');
          setIsReconnecting(false);
          console.error('[Realtime] Channel error');
        } else if (status === REALTIME_SUBSCRIBE_STATES.TIMED_OUT) {
          setIsConnected(false);
          setConnectionStatus('failed');
          setConnectionError('Connection timed out');
          setIsReconnecting(false);
          console.error('[Realtime] Subscription timed out');
        } else if (status === REALTIME_SUBSCRIBE_STATES.CLOSED) {
          setIsConnected(false);
          setConnectionStatus('disconnected');
        }
      });

    channelRef.current = channel;

    // Cleanup on unmount
    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      setIsConnected(false);
      setConnectionStatus('disconnected');
      setReconnectAttempt(0);
      setIsReconnecting(false);
      setConnectionStartTime(null);
    };
    // Use stable keys instead of object/array references to prevent reconnection loops
    // reconnectKey is used to force re-subscription when manual reconnect is triggered
  }, [sessionId, userId, handleDatabaseChange, handlePresenceSync, tablesKey, presenceDataKey, reconnectKey]);

  /**
   * Manual reconnection function
   * Removes current channel and triggers re-subscription by incrementing reconnectKey
   */
  const reconnect = useCallback(() => {
    if (isReconnecting) {
      return;
    }

    const currentAttempt = reconnectAttempt + 1;
    if (currentAttempt > maxReconnectAttempts) {
      setConnectionError(`Failed to reconnect after ${maxReconnectAttempts} attempts`);
      setConnectionStatus('failed');
      return;
    }

    setIsReconnecting(true);
    setReconnectAttempt(currentAttempt);

    // Remove current channel before triggering re-subscription
    const supabase = supabaseRef.current;
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    // Short delay before reconnecting to avoid rapid retry loops
    reconnectTimeoutRef.current = setTimeout(() => {
      setIsReconnecting(false);
      // Increment reconnectKey to trigger the useEffect and create a new channel
      setReconnectKey(prev => prev + 1);
    }, 500);
  }, [isReconnecting, reconnectAttempt, maxReconnectAttempts]);

  return {
    isConnected,
    connectionStatus,
    connectionError,
    lastMessage,
    onlineUsers,
    reconnectAttempt,
    maxReconnectAttempts,
    connectionStartTime,
    isReconnecting,
    reconnect,
  };
}
