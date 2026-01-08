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
}

const DEFAULT_TABLES = ['session_students', 'sessions', 'revisions'];

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
}: UseRealtimeOptions) {
  const [isConnected, setIsConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected');
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [lastMessage, setLastMessage] = useState<RealtimeMessage | null>(null);
  const [onlineUsers, setOnlineUsers] = useState<PresenceState>({});

  const channelRef = useRef<RealtimeChannel | null>(null);
  const supabaseRef = useRef(getSupabaseBrowserClient());

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
      channel.on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table,
          filter: `session_id=eq.${sessionId}`,
        },
        handleDatabaseChange
      );
    });

    // Subscribe to presence events
    if (userId) {
      channel
        .on('presence', { event: 'sync' }, () => handlePresenceSync(channel))
        .on('presence', { event: 'join' }, ({ key, newPresences }) => {
          console.log('[Realtime] User joined:', key, newPresences);
        })
        .on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
          console.log('[Realtime] User left:', key, leftPresences);
        });
    }

    // Subscribe to channel
    channel
      .subscribe(async (status) => {
        if (status === REALTIME_SUBSCRIBE_STATES.SUBSCRIBED) {
          setIsConnected(true);
          setConnectionStatus('connected');
          setConnectionError(null);

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
          console.error('[Realtime] Channel error');
        } else if (status === REALTIME_SUBSCRIBE_STATES.TIMED_OUT) {
          setIsConnected(false);
          setConnectionStatus('failed');
          setConnectionError('Connection timed out');
          console.error('[Realtime] Subscription timed out');
        } else if (status === REALTIME_SUBSCRIBE_STATES.CLOSED) {
          setIsConnected(false);
          setConnectionStatus('disconnected');
          console.log('[Realtime] Channel closed');
        }
      });

    channelRef.current = channel;

    // Cleanup on unmount
    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      setIsConnected(false);
      setConnectionStatus('disconnected');
    };
    // Use stable keys instead of object/array references to prevent reconnection loops
  }, [sessionId, userId, handleDatabaseChange, handlePresenceSync, tablesKey, presenceDataKey]);

  return {
    isConnected,
    connectionStatus,
    connectionError,
    lastMessage,
    onlineUsers,
  };
}
