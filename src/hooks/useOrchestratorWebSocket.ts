import { useEffect, useRef, useCallback, useState } from 'react';
import {
  ClientType,
  type ServerMessage,
  type ClientMessage,
  type TicketUpdatedMessage,
  type TicketStatusChangedMessage,
  type ProjectStatusChangedMessage,
} from '../../shared/types/orchestrator';

interface UseOrchestratorWebSocketOptions {
  projectId?: string;
  onTicketUpdated?: (message: TicketUpdatedMessage) => void;
  onTicketStatusChanged?: (message: TicketStatusChangedMessage) => void;
  onProjectStatusChanged?: (message: ProjectStatusChangedMessage) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
  enabled?: boolean;
}

interface WebSocketState {
  connected: boolean;
  authenticated: boolean;
  connectionId: string | null;
  error: string | null;
}

// Determine WebSocket URL based on environment
const getWebSocketUrl = () => {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const host = window.location.host;
  return `${protocol}//${host}/api/orchestrator/ws`;
};

const HEARTBEAT_INTERVAL = 30000; // 30 seconds
const RECONNECT_DELAY = 3000; // 3 seconds

export function useOrchestratorWebSocket(options: UseOrchestratorWebSocketOptions = {}) {
  const {
    projectId,
    onTicketUpdated,
    onTicketStatusChanged,
    onProjectStatusChanged,
    onConnect,
    onDisconnect,
    enabled = true,
  } = options;

  const wsRef = useRef<WebSocket | null>(null);
  const heartbeatRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectRef = useRef<NodeJS.Timeout | null>(null);
  const [state, setState] = useState<WebSocketState>({
    connected: false,
    authenticated: false,
    connectionId: null,
    error: null,
  });

  const cleanup = useCallback(() => {
    if (heartbeatRef.current) {
      clearInterval(heartbeatRef.current);
      heartbeatRef.current = null;
    }
    if (reconnectRef.current) {
      clearTimeout(reconnectRef.current);
      reconnectRef.current = null;
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
  }, []);

  const sendMessage = useCallback((message: ClientMessage) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    }
  }, []);

  const startHeartbeat = useCallback(() => {
    if (heartbeatRef.current) {
      clearInterval(heartbeatRef.current);
    }
    heartbeatRef.current = setInterval(() => {
      sendMessage({ type: 'pong', timestamp: new Date().toISOString() });
    }, HEARTBEAT_INTERVAL);
  }, [sendMessage]);

  const handleMessage = useCallback(
    (event: MessageEvent) => {
      try {
        const message = JSON.parse(event.data) as ServerMessage;

        switch (message.type) {
          case 'auth_success':
            setState((prev) => ({
              ...prev,
              authenticated: true,
              connectionId: message.connectionId,
              error: null,
            }));
            startHeartbeat();
            onConnect?.();
            
            // Subscribe to project if provided
            if (projectId) {
              sendMessage({ type: 'subscribe', projectId });
            }
            break;

          case 'ticket_updated':
            onTicketUpdated?.(message);
            break;

          case 'ticket_status_changed':
            onTicketStatusChanged?.(message);
            break;

          case 'project_status_changed':
            onProjectStatusChanged?.(message);
            break;

          case 'heartbeat':
            sendMessage({ type: 'pong', timestamp: message.timestamp || new Date().toISOString() });
            break;

          case 'error':
            setState((prev) => ({ ...prev, error: message.message }));
            console.error('WebSocket error:', message.message);
            break;
        }
      } catch (error) {
        console.error('Failed to parse WebSocket message:', error);
      }
    },
    [projectId, onTicketUpdated, onTicketStatusChanged, onProjectStatusChanged, onConnect, sendMessage, startHeartbeat]
  );

  const connect = useCallback(() => {
    if (!enabled) return;
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    cleanup();

    try {
      const ws = new WebSocket(getWebSocketUrl());
      wsRef.current = ws;

      ws.onopen = () => {
        setState((prev) => ({ ...prev, connected: true, error: null }));

        // Authenticate
        const token = localStorage.getItem('authToken');
        if (token) {
          sendMessage({
            type: 'authenticate',
            token,
            clientType: ClientType.WEB,
            projectId,
          });
        } else {
          setState((prev) => ({
            ...prev,
            error: 'No authentication token found',
          }));
          ws.close();
        }
      };

      ws.onmessage = handleMessage;

      ws.onerror = () => {
        setState((prev) => ({ ...prev, error: 'WebSocket connection error' }));
      };

      ws.onclose = () => {
        setState({
          connected: false,
          authenticated: false,
          connectionId: null,
          error: null,
        });
        onDisconnect?.();

        if (heartbeatRef.current) {
          clearInterval(heartbeatRef.current);
          heartbeatRef.current = null;
        }

        // Attempt to reconnect after delay
        if (enabled) {
          reconnectRef.current = setTimeout(() => {
            connect();
          }, RECONNECT_DELAY);
        }
      };
    } catch (error) {
      console.error('Failed to connect WebSocket:', error);
      setState((prev) => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Connection failed',
      }));
    }
  }, [enabled, projectId, handleMessage, sendMessage, cleanup, onDisconnect]);

  const subscribe = useCallback(
    (newProjectId: string) => {
      sendMessage({ type: 'subscribe', projectId: newProjectId });
    },
    [sendMessage]
  );

  const unsubscribe = useCallback(
    (oldProjectId: string) => {
      sendMessage({ type: 'unsubscribe', projectId: oldProjectId });
    },
    [sendMessage]
  );

  // Connect on mount and when enabled changes
  useEffect(() => {
    if (enabled) {
      connect();
    } else {
      cleanup();
    }

    return cleanup;
  }, [enabled, connect, cleanup]);

  // Handle project ID changes
  useEffect(() => {
    if (state.authenticated && projectId) {
      subscribe(projectId);
    }
  }, [state.authenticated, projectId, subscribe]);

  return {
    connected: state.connected,
    authenticated: state.authenticated,
    connectionId: state.connectionId,
    error: state.error,
    subscribe,
    unsubscribe,
    reconnect: connect,
  };
}