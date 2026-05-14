import { useEffect, useRef, useCallback, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuthStore } from '../../auth/stores/auth.store';

export type Collaborator = {
  userId: string;
  displayName: string;
  color: string;
};

export type TypingParticipant = {
  userId: string;
  displayName: string;
  color: string;
  updatedAt: number;
};

type UseCollaborationOptions = {
  noteId: string | null;
  /** Only connect when the shared note has EDIT permission */
  enabled: boolean;
  /** Called when a remote user pushes a content update */
  onRemoteContentUpdate?: (data: { userId: string; content: string; title?: string; timestamp: number }) => void;
  /** Called when a remote cursor position is received */
  onRemoteCursor?: (data: { userId: string; displayName: string; position: number; color: string }) => void;
};

// Derive the WS URL from the current page location so it works in
// both local dev (localhost:4000) and Docker (same origin via proxy).
function getWsUrl(): string {
  if (typeof window === 'undefined') return '';

  // In production/Docker, the API is typically reverse-proxied through the same origin
  // or exposed on a known host.  Check for an env variable first.
  const envUrl = (import.meta as unknown as { env?: Record<string, string> }).env?.VITE_WS_URL;
  if (envUrl) return envUrl;

  // Fallback: use the same base as the REST API
  const apiBaseUrl = (import.meta as unknown as { env?: Record<string, string> }).env?.VITE_API_URL;
  if (apiBaseUrl) {
    try {
      const url = new URL(apiBaseUrl);
      return `${url.protocol === 'https:' ? 'wss' : 'ws'}://${url.host}`;
    } catch {
      // ignore parse errors
    }
  }

  // Last resort: same host, port 4000
  return `ws://${window.location.hostname}:4000`;
}

export function useCollaboration({ noteId, enabled, onRemoteContentUpdate, onRemoteCursor }: UseCollaborationOptions) {
  const accessToken = useAuthStore((state) => state.accessToken);
  const socketRef = useRef<Socket | null>(null);
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [typingParticipants, setTypingParticipants] = useState<TypingParticipant[]>([]);
  const [isConnected, setIsConnected] = useState(false);

  // Keep callback refs stable to avoid reconnection loops
  const onRemoteContentUpdateRef = useRef(onRemoteContentUpdate);
  onRemoteContentUpdateRef.current = onRemoteContentUpdate;
  const onRemoteCursorRef = useRef(onRemoteCursor);
  onRemoteCursorRef.current = onRemoteCursor;

  useEffect(() => {
    if (!enabled || !noteId || !accessToken) {
      // Clean up if conditions are no longer met
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
        setIsConnected(false);
        setCollaborators([]);
        setTypingParticipants([]);
      }
      return;
    }

    const wsUrl = getWsUrl();
    const socket = io(`${wsUrl}/collaboration`, {
      auth: { token: accessToken },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 10,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      setIsConnected(true);
      socket.emit('note:join', { noteId });
    });

    socket.on('disconnect', () => {
      setIsConnected(false);
      setCollaborators([]);
      setTypingParticipants([]);
    });

    socket.on('collaborators:list', (list: Collaborator[]) => {
      setCollaborators(list);
    });

    socket.on('collaborator:joined', (collaborator: Collaborator) => {
      setCollaborators((prev) => {
        if (prev.some((c) => c.userId === collaborator.userId)) return prev;
        return [...prev, collaborator];
      });
    });

    socket.on('collaborator:left', (data: { userId: string }) => {
      setCollaborators((prev) => prev.filter((c) => c.userId !== data.userId));
    });

    socket.on('note:updated', (data: { userId: string; content: string; title?: string; timestamp: number }) => {
      onRemoteContentUpdateRef.current?.(data);
    });

    socket.on('note:cursor', (data: { userId: string; displayName: string; position: number; color: string }) => {
      onRemoteCursorRef.current?.(data);
    });

    socket.on('typing:list', (list: TypingParticipant[]) => {
      setTypingParticipants(list);
    });

    return () => {
      socket.emit('note:leave');
      socket.disconnect();
      socketRef.current = null;
      setIsConnected(false);
      setCollaborators([]);
      setTypingParticipants([]);
    };
  }, [noteId, enabled, accessToken]);

  const sendContentUpdate = useCallback(
    (content: string, title?: string) => {
      if (socketRef.current?.connected && noteId) {
        socketRef.current.emit('note:update', { noteId, content, title });
      }
    },
    [noteId],
  );

  const sendCursorPosition = useCallback(
    (position: number) => {
      if (socketRef.current?.connected && noteId) {
        socketRef.current.emit('note:cursor', { noteId, position });
      }
    },
    [noteId],
  );

  const sendTypingState = useCallback(
    (isTyping: boolean) => {
      if (socketRef.current?.connected && noteId) {
        socketRef.current.emit('note:typing', { noteId, isTyping });
      }
    },
    [noteId],
  );

  return {
    collaborators,
    typingParticipants,
    isConnected,
    sendContentUpdate,
    sendCursorPosition,
    sendTypingState,
  };
}
