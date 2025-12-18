'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

export interface Message {
  type: string;
  payload: any;
}

export type ConnectionStatus = 'connected' | 'connecting' | 'disconnected' | 'failed';

export function useWebSocket(url: string) {
  const [isConnected, setIsConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected');
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [lastMessage, setLastMessage] = useState<Message | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5;

  const connect = useCallback(() => {
    // Don't attempt connection if URL is empty (SSR or not yet initialized)
    if (!url) {
      console.log('WebSocket URL not yet available, skipping connection');
      return;
    }

    // Check if we've exceeded max reconnect attempts
    if (reconnectAttempts.current >= maxReconnectAttempts) {
      setConnectionStatus('failed');
      setConnectionError('Unable to connect to server. Please refresh the page.');
      return;
    }

    try {
      console.log('Attempting WebSocket connection to:', url);
      setConnectionStatus('connecting');
      setConnectionError(null);
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('WebSocket connected to:', url);
        setIsConnected(true);
        setConnectionStatus('connected');
        setConnectionError(null);
        reconnectAttempts.current = 0;
      };

      ws.onmessage = (event) => {
        try {
          const message: Message = JSON.parse(event.data);
          setLastMessage(message);
        } catch (error) {
          console.error('Error parsing message:', error);
          setConnectionError('Received invalid message from server');
        }
      };

      ws.onclose = (event) => {
        console.log('WebSocket disconnected from:', url, 'Code:', event.code);
        setIsConnected(false);
        setConnectionStatus('disconnected');
        
        // Don't reconnect if it was a normal closure
        if (event.code === 1000) {
          return;
        }
        
        // Attempt to reconnect with exponential backoff
        const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 30000);
        reconnectAttempts.current++;
        
        if (reconnectAttempts.current < maxReconnectAttempts) {
          setConnectionError(`Connection lost. Reconnecting in ${Math.ceil(delay / 1000)}s...`);
          reconnectTimeoutRef.current = setTimeout(() => {
            console.log(`Reconnecting... (attempt ${reconnectAttempts.current})`);
            connect();
          }, delay);
        } else {
          setConnectionStatus('failed');
          setConnectionError('Unable to reconnect. Please refresh the page.');
        }
      };

      ws.onerror = (error) => {
        console.error('WebSocket error for URL:', url, error);
        setConnectionError('Connection error occurred');
      };
    } catch (error) {
      console.error('Error creating WebSocket for URL:', url, error);
    }
  }, [url]);

  useEffect(() => {
    connect();

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [connect]);

  const sendMessage = useCallback((type: string, payload: any) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      try {
        wsRef.current.send(JSON.stringify({ type, payload }));
      } catch (error) {
        console.error('Error sending message:', error);
        setConnectionError('Failed to send message');
      }
    } else {
      console.error('WebSocket is not connected');
      setConnectionError('Not connected to server');
    }
  }, []);

  return {
    isConnected,
    connectionStatus,
    connectionError,
    lastMessage,
    sendMessage,
  };
}
