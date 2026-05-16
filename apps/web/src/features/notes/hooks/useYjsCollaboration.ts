import { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import * as Y from 'yjs';
import * as awarenessProtocol from 'y-protocols/awareness';
import { io, type Socket } from 'socket.io-client';
import { useAuthStore } from '../../auth/stores/auth.store';

// Shared Y.Doc instances keyed by noteId to ensure one stable Y.Doc per note
const sharedYDocs = new Map<string, Y.Doc>();

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
  const [isConnected, setIsConnected] = useState(false);
  const [yDoc, setYDoc] = useState<Y.Doc | null>(null);
  const [awareness, setAwareness] = useState<awarenessProtocol.Awareness | null>(null);

  const socketRef = useRef<Socket | null>(null);
  const applyingRemoteUpdateRef = useRef(false);
  const refreshInFlightRef = useRef(false);
  const refreshAttemptedRef = useRef(false);
  const syncedSocketIdRef = useRef<string | null>(null);
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
      setIsConnected(false);
      setYDoc(null);
      setAwareness(null);
      return;
    }

    // Use a shared Y.Doc per noteId so multiple hook instances/remounts share the same document.
    // This prevents creating multiple distinct Y.Docs for the same note which breaks rendering bindings.
    let nextYDoc: Y.Doc;
    if (noteId && sharedYDocs.has(noteId)) {
      nextYDoc = sharedYDocs.get(noteId)!;
    } else {
      nextYDoc = new Y.Doc();
      if (noteId) sharedYDocs.set(noteId, nextYDoc);
    }

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

    const syncState = (socket: Socket) => {
      if (socket.connected) {
        console.log('[Yjs] Emitting note:join for', noteId);
        socket.emit('note:join', { noteId });
        setTimeout(() => {
          if (socket.connected) {
            console.log('[Yjs] sync-step-1 fragment length before send', nextYDoc.getXmlFragment('prosemirror').length);
            console.log('[Yjs] Emitting yjs:sync-step-1 for', noteId);
            socket.emit('yjs:sync-step-1', {
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
        console.log('[Yjs] applying remote update', update.length, 'fragment length before apply', nextYDoc.getXmlFragment('prosemirror').length);
        Y.applyUpdate(nextYDoc, update);
        console.log('[Yjs] applied remote update', update.length, 'fragment length after apply', nextYDoc.getXmlFragment('prosemirror').length);
      } finally {
        applyingRemoteUpdateRef.current = false;
      }
    };

    const handleDocUpdate = (update: Uint8Array) => {
      if (applyingRemoteUpdateRef.current) {
        return;
      }

      if (socketRef.current?.connected) {
        console.log('[Yjs] local update', update.length, 'fragment length', nextYDoc.getXmlFragment('prosemirror').length);
        console.log('[Yjs] emitting yjs:update', noteId, update.length);
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
      const currentSocketId = socket.id ?? null;
      if (currentSocketId && syncedSocketIdRef.current === currentSocketId) {
        return;
      }
      syncedSocketIdRef.current = currentSocketId;

      console.log('[Yjs] Socket connected, initiating sync');
      setIsConnected(true);
      setTimeout(() => {
        console.log('[Yjs] Calling syncState');
        syncState(socket);
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
      syncedSocketIdRef.current = null;
      setIsConnected(false);
      setCollaborators([]);
      setPresenceParticipants([]);
      setTypingParticipants([]);
    });

    socket.on('collaborators:list', (list: Collaborator[]) => {
      setCollaborators(list);
      // Filter out self from presence participants
      const otherParticipants = list.filter((p) => p.userId !== user?.id);
      setPresenceParticipants(otherParticipants);
    });

    socket.on('presence:list', (list: PresenceParticipant[]) => {
      // Filter out self from presence participants
      const otherParticipants = list.filter((p) => p.userId !== user?.id);
      setPresenceParticipants(otherParticipants);
    });

    socket.on('typing:list', (list: TypingParticipant[]) => {
      setTypingParticipants(list);
    });

    socket.on('collaborator:joined', (collaborator: Collaborator) => {
      setCollaborators((current) => (current.some((entry) => entry.userId === collaborator.userId) ? current : [...current, collaborator]));
      // Add to presence participants if not self and not already present
      if (collaborator.userId !== user?.id) {
        setPresenceParticipants((current) => (current.some((entry) => entry.userId === collaborator.userId) ? current : [...current, collaborator]));
      }
    });

    socket.on('collaborator:left', (data: { userId: string }) => {
      setCollaborators((current) => current.filter((entry) => entry.userId !== data.userId));
      setPresenceParticipants((current) => current.filter((entry) => entry.userId !== data.userId));
      setTypingParticipants((current) => current.filter((entry) => entry.userId !== data.userId));
      // Remote cursors managed by awareness/CollaborationCursor extension
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
        console.log('[Yjs] received yjs:sync-step-2', data.update.length);
        handleRemoteUpdate(new Uint8Array(data.update));
      }
    });

    socket.on('yjs:update', (data: { noteId: string; update: number[] }) => {
      if (data.noteId === noteId) {
        console.log('[Yjs] received yjs:update', data.update.length, 'fragment length before apply', nextYDoc.getXmlFragment('prosemirror').length);
        handleRemoteUpdate(new Uint8Array(data.update));
      }
    });

    socket.on('yjs:awareness:update', (data: { noteId: string; states: RemoteCursorState[] }) => {
      if (data.noteId !== noteId) {
        return;
      }

      // Remote cursors are now handled by the CollaborationCursor extension via awareness
      // No need to manage state here
    });

    socket.on('yjs:awareness:list', (data: { noteId: string; states: RemoteCursorState[] }) => {
      if (data.noteId !== noteId) {
        return;
      }

      // Remote cursors are now handled by the CollaborationCursor extension via awareness
      // No need to manage state here
    });

    // Attach update listener to emit local updates to the socket
    try {
      const debugDoc = nextYDoc as Y.Doc & { guid?: string | number; clientID?: string | number };
      // eslint-disable-next-line no-console
      console.log('[Yjs] Attaching update listener to Y.Doc', debugDoc.guid ?? debugDoc.clientID);
    } catch {
      // ignore
    }
    nextYDoc.on('update', handleDocUpdate);

    // Forward local awareness updates to the server so other sockets get notified
    const awarenessUpdateHandler = () => {
      try {
        const localState = nextAwareness.getLocalState();
        if (socketRef.current?.connected && noteId) {
          socketRef.current.emit('yjs:awareness', { noteId, awareness: localState });
        }
      } catch {
        // ignore
      }
    };

    try {
      nextAwareness.on('update', awarenessUpdateHandler);
    } catch {
      // ignore
    }

    socket.connect();

    return () => {
      // Remove our update listener and destroy local awareness, but do NOT destroy the shared Y.Doc
      // because other hook instances or components may still rely on the same document.
      try {
        const debugDoc = nextYDoc as Y.Doc & { guid?: string | number; clientID?: string | number };
        // eslint-disable-next-line no-console
        console.log('[Yjs] Removing update listener from Y.Doc', debugDoc.guid ?? debugDoc.clientID);
      } catch {
        // ignore
      }
      nextYDoc.off('update', handleDocUpdate);
      try {
        nextAwareness.off('update', awarenessUpdateHandler);
      } catch {
        // ignore
      }
      try {
        nextAwareness.destroy();
      } catch {
        // ignore
      }

      socket.emit('note:leave');
      socket.disconnect();
      syncedSocketIdRef.current = null;
      socketRef.current = null;
      setIsConnected(false);
      setCollaborators([]);
      setPresenceParticipants([]);
      setTypingParticipants([]);
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
    // Update local awareness state; the hook forwards awareness updates to the server.
    try {
      if (awareness) {
        awareness.setLocalStateField('cursor', {
          userId: user?.id ?? '',
          displayName: user?.displayName ?? 'Anonymous',
          color: '#3b82f6',
          position,
        });
      } else if (socketRef.current?.connected && noteId) {
        // Fallback: emit awareness directly if awareness instance is not available
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
    } catch {
      // ignore
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
    yDoc,
    awareness,
    sendContentUpdate,
    sendCursorPosition,
    sendTypingState,
    // Local user metadata for CollaborationCursor
    localUser: {
      userId: user?.id ?? '',
      displayName: user?.displayName ?? 'Anonymous',
      color: '#3b82f6',
    },
  };
}
