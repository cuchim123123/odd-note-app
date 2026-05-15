import { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import * as Y from 'yjs';
import * as awarenessProtocol from 'y-protocols/awareness';
import { io, type Socket } from 'socket.io-client';
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

export type PresenceParticipant = Collaborator;

export type RemoteCursorState = {
  userId: string;
  displayName: string;
  color: string;
  position: number;
  selection?: { anchor: number; head: number };
};

type UseYjsCollaborationOptions = {
  noteId: string | null;
  enabled: boolean;
  onRemoteContentUpdate?: (data: {
    userId: string;
    content: string;
    title?: string;
    isPinned?: boolean;
    isProtected?: boolean;
    timestamp: number;
  }) => void;
  onRemoteCursor?: (data: RemoteCursorState) => void;
};

function getWsUrl(): string {
  if (typeof window === 'undefined') {
    return '';
  }

  const envUrl = (import.meta as unknown as { env?: Record<string, string> }).env?.VITE_WS_URL;
  if (envUrl) {
    try {
      const url = new URL(envUrl);
      if (url.protocol === 'ws:') url.protocol = 'http:';
      if (url.protocol === 'wss:') url.protocol = 'https:';
      return url.origin;
    } catch {
      return envUrl.startsWith('ws://') ? envUrl.replace(/^ws:\/\//, 'http://') : envUrl.replace(/^wss:\/\//, 'https://');
    }
  }

  const apiBaseUrl = (import.meta as unknown as { env?: Record<string, string> }).env?.VITE_API_URL;
  if (apiBaseUrl) {
    try {
      return new URL(apiBaseUrl).origin;
    } catch {
      // ignore parse errors
    }
  }

  return `${window.location.protocol === 'https:' ? 'https' : 'http'}://${window.location.hostname}:4000`;
}

function isJwtExpired(token: string, skewSeconds = 30): boolean {
  const parts = token.split('.');
  if (parts.length !== 3) {
    return true;
  }

  try {
    const payloadPart = parts[1];
    if (!payloadPart) {
      return true;
    }

    const payload = JSON.parse(atob(payloadPart.replace(/-/g, '+').replace(/_/g, '/')));
    if (typeof payload?.exp !== 'number') {
      return true;
    }

    const nowSeconds = Math.floor(Date.now() / 1000);
    return payload.exp <= nowSeconds + skewSeconds;
  } catch {
    return true;
  }
}

export function useYjsCollaboration({
  noteId,
  enabled,
  onRemoteContentUpdate,
  onRemoteCursor,
}: UseYjsCollaborationOptions) {
  const accessToken = useAuthStore((state) => state.accessToken);
  const user = useAuthStore((state) => state.user);
  const refreshToken = useAuthStore((state) => state.refreshToken);

  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [presenceParticipants, setPresenceParticipants] = useState<PresenceParticipant[]>([]);
  const [typingParticipants, setTypingParticipants] = useState<TypingParticipant[]>([]);
  const [remoteCursors, setRemoteCursors] = useState<RemoteCursorState[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [yDoc, setYDoc] = useState<Y.Doc | null>(null);
  const [awareness, setAwareness] = useState<awarenessProtocol.Awareness | null>(null);

  const socketRef = useRef<Socket | null>(null);
  const applyingRemoteUpdateRef = useRef(false);
  const refreshInFlightRef = useRef(false);
  const refreshAttemptedRef = useRef(false);
  const onRemoteContentUpdateRef = useRef(onRemoteContentUpdate);
  const onRemoteCursorRef = useRef(onRemoteCursor);

  onRemoteContentUpdateRef.current = onRemoteContentUpdate;
  onRemoteCursorRef.current = onRemoteCursor;

  useEffect(() => {
    if (!enabled || !noteId || !accessToken || !user) {
      socketRef.current?.disconnect();
      socketRef.current = null;
      refreshAttemptedRef.current = false;
      setCollaborators([]);
      setPresenceParticipants([]);
      setTypingParticipants([]);
      setRemoteCursors([]);
      setIsConnected(false);
      setYDoc(null);
      setAwareness(null);
      return;
    }

    const nextYDoc = new Y.Doc();
    const nextAwareness = new awarenessProtocol.Awareness(nextYDoc);
    setYDoc(nextYDoc);
    setAwareness(nextAwareness);

    if (accessToken && refreshToken && isJwtExpired(accessToken) && !refreshInFlightRef.current) {
      refreshInFlightRef.current = true;
      void (async () => {
        try {
          console.log('[Yjs] Access token is expired; refreshing before socket connect');
          const response = await axios.post(
            `${getWsUrl()}/auth/refresh`,
            { refreshToken },
            { withCredentials: true },
          );

          const nextAccessToken = response.data?.accessToken as string | undefined;
          const nextRefreshToken = response.data?.refreshToken as string | undefined;
          if (!nextAccessToken || !nextRefreshToken) {
            throw new Error('Refresh response missing tokens');
          }

          useAuthStore.getState().setTokens(nextAccessToken, nextRefreshToken);
          refreshAttemptedRef.current = false;
        } catch (refreshError) {
          console.error('[Yjs] Failed to refresh access token before connect', refreshError);
          useAuthStore.getState().logout();
        } finally {
          refreshInFlightRef.current = false;
        }
      })();
      return;
    }

    const syncState = () => {
      if (socketRef.current?.connected) {
        console.log('[Yjs] Emitting note:join for', noteId);
        socketRef.current.emit('note:join', { noteId });
        setTimeout(() => {
          if (socketRef.current?.connected) {
            console.log('[Yjs] Emitting yjs:sync-step-1 for', noteId);
            socketRef.current.emit('yjs:sync-step-1', {
              noteId,
              stateVector: Array.from(Y.encodeStateVector(nextYDoc)),
            });
          }
        }, 50);
      }
    };

    const handleRemoteUpdate = (update: Uint8Array) => {
      applyingRemoteUpdateRef.current = true;
      try {
        Y.applyUpdate(nextYDoc, update);
      } finally {
        applyingRemoteUpdateRef.current = false;
      }
    };

    const handleDocUpdate = (update: Uint8Array) => {
      if (applyingRemoteUpdateRef.current) {
        return;
      }

      if (socketRef.current?.connected) {
        socketRef.current.emit('yjs:update', {
          noteId,
          update: Array.from(update),
        });
      }
    };

    const socket = io(`${getWsUrl()}/collaboration`, {
      auth: { token: accessToken },
      transports: ['websocket', 'polling'],
      autoConnect: false,
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 10,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('[Yjs] Socket connected, initiating sync');
      setIsConnected(true);
      setTimeout(() => {
        console.log('[Yjs] Calling syncState');
        syncState();
      }, 100);
    });

    socket.on('connect_error', (error) => {
      console.error('[Yjs] Socket connect_error', error);
      setIsConnected(false);

      if (refreshAttemptedRef.current || !refreshToken) {
        return;
      }

      refreshAttemptedRef.current = true;
      void (async () => {
        try {
          console.log('[Yjs] Refreshing expired access token before reconnect');
          const response = await axios.post(
            `${getWsUrl()}/auth/refresh`,
            { refreshToken },
            { withCredentials: true },
          );

          const nextAccessToken = response.data?.accessToken as string | undefined;
          const nextRefreshToken = response.data?.refreshToken as string | undefined;
          if (!nextAccessToken || !nextRefreshToken) {
            throw new Error('Refresh response missing tokens');
          }

          useAuthStore.getState().setTokens(nextAccessToken, nextRefreshToken);
          refreshAttemptedRef.current = false;
        } catch (refreshError) {
          console.error('[Yjs] Failed to refresh socket token', refreshError);
          useAuthStore.getState().logout();
        }
      })();
    });

    socket.on('error', (error) => {
      console.error('[Yjs] Socket error', error);
    });

    socket.on('disconnect', () => {
      setIsConnected(false);
      setCollaborators([]);
      setPresenceParticipants([]);
      setTypingParticipants([]);
      setRemoteCursors([]);
    });

    socket.on('collaborators:list', (list: Collaborator[]) => {
      setCollaborators(list);
      setPresenceParticipants(list);
    });

    socket.on('presence:list', (list: PresenceParticipant[]) => {
      setPresenceParticipants(list);
    });

    socket.on('typing:list', (list: TypingParticipant[]) => {
      setTypingParticipants(list);
    });

    socket.on('collaborator:joined', (collaborator: Collaborator) => {
      setCollaborators((current) => (current.some((entry) => entry.userId === collaborator.userId) ? current : [...current, collaborator]));
    });

    socket.on('collaborator:left', (data: { userId: string }) => {
      setCollaborators((current) => current.filter((entry) => entry.userId !== data.userId));
      setPresenceParticipants((current) => current.filter((entry) => entry.userId !== data.userId));
      setTypingParticipants((current) => current.filter((entry) => entry.userId !== data.userId));
      setRemoteCursors((current) => current.filter((entry) => entry.userId !== data.userId));
    });

    socket.on('note:updated', (data: {
      userId: string;
      content: string;
      title?: string;
      isPinned?: boolean;
      isProtected?: boolean;
      timestamp: number;
    }) => {
      onRemoteContentUpdateRef.current?.(data);
    });

    socket.on('yjs:sync-step-2', (data: { noteId: string; update: number[] }) => {
      if (data.noteId === noteId) {
        handleRemoteUpdate(new Uint8Array(data.update));
      }
    });

    socket.on('yjs:update', (data: { noteId: string; update: number[] }) => {
      if (data.noteId === noteId) {
        handleRemoteUpdate(new Uint8Array(data.update));
      }
    });

    socket.on('yjs:awareness:update', (data: { noteId: string; states: RemoteCursorState[] }) => {
      if (data.noteId !== noteId) {
        return;
      }

      setRemoteCursors(data.states);
      data.states.forEach((cursor) => onRemoteCursorRef.current?.(cursor));
    });

    socket.on('yjs:awareness:list', (data: { noteId: string; states: RemoteCursorState[] }) => {
      if (data.noteId !== noteId) {
        return;
      }

      setRemoteCursors(data.states);
    });

    nextYDoc.on('update', handleDocUpdate);

    socket.connect();

    return () => {
      nextYDoc.off('update', handleDocUpdate);
      nextYDoc.destroy();
      nextAwareness.destroy();
      socket.emit('note:leave');
      socket.disconnect();
      socketRef.current = null;
      setIsConnected(false);
      setCollaborators([]);
      setPresenceParticipants([]);
      setTypingParticipants([]);
      setRemoteCursors([]);
      setYDoc(null);
      setAwareness(null);
    };
  }, [accessToken, enabled, noteId, user]);

  const sendContentUpdate = (content?: string, title?: string, metadata?: { isPinned?: boolean; isProtected?: boolean }) => {
    if (socketRef.current?.connected && noteId) {
      socketRef.current.emit('note:update', { noteId, content, title, ...metadata });
    }
  };

  const sendCursorPosition = (position: number) => {
    if (socketRef.current?.connected && noteId) {
      socketRef.current.emit('yjs:awareness', {
        noteId,
        awareness: {
          userId: user?.id ?? '',
          displayName: user?.displayName ?? 'Anonymous',
          color: '#3b82f6',
          position,
        },
      });
    }
  };

  const sendTypingState = (isTyping: boolean) => {
    if (socketRef.current?.connected && noteId) {
      socketRef.current.emit('note:typing', { noteId, isTyping });
    }
  };

  return {
    collaborators,
    presenceParticipants,
    typingParticipants,
    isConnected,
    remoteCursors,
    yDoc,
    awareness,
    sendContentUpdate,
    sendCursorPosition,
    sendTypingState,
  };
}
