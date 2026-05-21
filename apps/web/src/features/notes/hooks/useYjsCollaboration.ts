import { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import * as Y from 'yjs';
import { io, type Socket } from 'socket.io-client';
import { useAuthStore } from '../../auth/stores/auth.store';
import { useNoteProtectionStore } from '../stores/note-protection.store';
import {
  NOTE_COLLABORATION_EVENTS,
  NOTE_COLLABORATION_FRAGMENT_NAME,
  NOTE_COLLABORATION_NAMESPACE,
  NOTE_COLLABORATION_RECONNECT_DELAY_MS,
  NOTE_COLLABORATION_REFRESH_MAX_ATTEMPTS,
  NOTE_COLLABORATION_SYNC_JOIN_DELAY_MS,
  NOTE_COLLABORATION_SYNC_RETRY_DELAY_MS,
} from '../constants/note-collaboration.constants';

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

type UseYjsCollaborationOptions = {
  noteId: string | null;
  enabled: boolean;
  onRemoteContentUpdate?: (data: {
    userId: string;
    content: string;
    title?: string | undefined;
    isPinned?: boolean | undefined;
    isProtected?: boolean | undefined;
    labels?: string[] | undefined;
    timestamp: number;
  }) => void;
  onNoteDeleted?: (noteId: string) => void;
  onPermissionsUpdated?: () => void;
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
    if (apiBaseUrl.startsWith('/')) {
      return window.location.origin;
    }
    try {
      return new URL(apiBaseUrl).origin;
    } catch {
      // ignore parse errors
    }
  }

  if (window.location.port === '5173') {
    return `${window.location.protocol === 'https:' ? 'https' : 'http'}://${window.location.hostname}:4000`;
  }
  return window.location.origin;
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
  onNoteDeleted,
  onPermissionsUpdated,
}: UseYjsCollaborationOptions) {
  const accessToken = useAuthStore((state) => state.accessToken);
  const user = useAuthStore((state) => state.user);
  const refreshToken = useAuthStore((state) => state.refreshToken);
  const unlockToken = useNoteProtectionStore((s) => noteId ? s.unlockTokens[noteId] : undefined);

  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [presenceParticipants, setPresenceParticipants] = useState<PresenceParticipant[]>([]);
  const [typingParticipants, setTypingParticipants] = useState<TypingParticipant[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [yDoc, setYDoc] = useState<Y.Doc | null>(null);
  const [isSynced, setIsSynced] = useState(false);

  const socketRef = useRef<Socket | null>(null);
  const applyingRemoteUpdateRef = useRef(false);
  const refreshInFlightRef = useRef(false);
  const refreshAttemptedRef = useRef(false);
  const syncedSocketIdRef = useRef<string | null>(null);
  const onRemoteContentUpdateRef = useRef(onRemoteContentUpdate);
  const onNoteDeletedRef = useRef(onNoteDeleted);
  const onPermissionsUpdatedRef = useRef(onPermissionsUpdated);

  onRemoteContentUpdateRef.current = onRemoteContentUpdate;
  onNoteDeletedRef.current = onNoteDeleted;
  onPermissionsUpdatedRef.current = onPermissionsUpdated;

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
      setIsSynced(false);
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

    setYDoc(nextYDoc);

    if (accessToken && refreshToken && isJwtExpired(accessToken) && !refreshInFlightRef.current) {
      refreshInFlightRef.current = true;
      void (async () => {
        try {
          console.warn('[Yjs] Access token is expired; refreshing before socket connect');
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
        console.warn('[Yjs] Emitting note:join for', noteId);
        socket.emit(NOTE_COLLABORATION_EVENTS.join, { noteId, unlockToken });
        setTimeout(() => {
          if (socket.connected) {
            console.warn('[Yjs] sync-step-1 fragment length before send', nextYDoc.getXmlFragment(NOTE_COLLABORATION_FRAGMENT_NAME).length);
            console.warn('[Yjs] Emitting yjs:sync-step-1 for', noteId);
            socket.emit(NOTE_COLLABORATION_EVENTS.syncStep1, {
              noteId,
              stateVector: Array.from(Y.encodeStateVector(nextYDoc)),
            });
          }
        }, NOTE_COLLABORATION_SYNC_JOIN_DELAY_MS);
      }
    };

    const handleRemoteUpdate = (update: Uint8Array) => {
      applyingRemoteUpdateRef.current = true;
      try {
        console.warn('[Yjs] applying remote update', update.length, 'fragment length before apply', nextYDoc.getXmlFragment(NOTE_COLLABORATION_FRAGMENT_NAME).length);
        Y.applyUpdate(nextYDoc, update);
        console.warn('[Yjs] applied remote update', update.length, 'fragment length after apply', nextYDoc.getXmlFragment(NOTE_COLLABORATION_FRAGMENT_NAME).length);
      } finally {
        applyingRemoteUpdateRef.current = false;
      }
    };

    const handleDocUpdate = (update: Uint8Array) => {
      if (applyingRemoteUpdateRef.current) {
        return;
      }

      if (socketRef.current?.connected) {
        console.warn('[Yjs] local update', update.length, 'fragment length', nextYDoc.getXmlFragment(NOTE_COLLABORATION_FRAGMENT_NAME).length);
        console.warn('[Yjs] emitting yjs:update', noteId, update.length);
        socketRef.current.emit(NOTE_COLLABORATION_EVENTS.yjsUpdate, {
          noteId,
          update: Array.from(update),
        });
      }
    };

    const socket = io(`${getWsUrl()}${NOTE_COLLABORATION_NAMESPACE}`, {
      auth: { token: accessToken },
      transports: ['websocket', 'polling'],
      autoConnect: false,
      reconnection: true,
      reconnectionDelay: NOTE_COLLABORATION_RECONNECT_DELAY_MS,
      reconnectionAttempts: NOTE_COLLABORATION_REFRESH_MAX_ATTEMPTS,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      const currentSocketId = socket.id ?? null;
      if (currentSocketId && syncedSocketIdRef.current === currentSocketId) {
        return;
      }
      syncedSocketIdRef.current = currentSocketId;

      console.warn('[Yjs] Socket connected, initiating sync');
      setIsConnected(true);
      setTimeout(() => {
        console.warn('[Yjs] Calling syncState');
        syncState(socket);
      }, NOTE_COLLABORATION_SYNC_RETRY_DELAY_MS);
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
          console.warn('[Yjs] Refreshing expired access token before reconnect');
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
    });

    socket.on('note:updated', (data: {
      userId: string;
      content: string;
      title?: string;
      isPinned?: boolean | undefined;
      isProtected?: boolean | undefined;
      labels?: string[] | undefined;
      timestamp: number;
    }) => {
      onRemoteContentUpdateRef.current?.(data);
    });

    socket.on('note:deleted', (data: { noteId: string }) => {
      onNoteDeletedRef.current?.(data.noteId);
    });
 
    socket.on('note:permissions_updated', () => {
      onPermissionsUpdatedRef.current?.();
    });

    socket.on('yjs:sync-step-2', (data: { noteId: string; update: number[]; stateVector?: number[] }) => {
      if (data.noteId === noteId) {
        console.warn('[Yjs] received yjs:sync-step-2', data.update.length);
        handleRemoteUpdate(new Uint8Array(data.update));
        setIsSynced(true);

        // If server sent its state vector, send back our missing updates (Step 3)
        if (data.stateVector) {
          const missingUpdate = Y.encodeStateAsUpdate(nextYDoc, new Uint8Array(data.stateVector));
          if (missingUpdate.length > 0) {
            console.warn('[Yjs] emitting yjs:sync-step-3', missingUpdate.length);
            socket.emit('yjs:sync-step-3', {
              noteId: data.noteId,
              update: Array.from(missingUpdate),
            });
          }
        }
      }
    });

    socket.on(NOTE_COLLABORATION_EVENTS.yjsUpdate, (data: { noteId: string; update: number[] }) => {
      if (data.noteId === noteId) {
        console.warn('[Yjs] received yjs:update', data.update.length, 'fragment length before apply', nextYDoc.getXmlFragment(NOTE_COLLABORATION_FRAGMENT_NAME).length);
        handleRemoteUpdate(new Uint8Array(data.update));
      }
    });

    // Attach update listener to emit local updates to the socket
    try {
      const debugDoc = nextYDoc as Y.Doc & { guid?: string | number; clientID?: string | number };
       
      console.warn('[Yjs] Attaching update listener to Y.Doc', debugDoc.guid ?? debugDoc.clientID);
    } catch {
      // ignore
    }
    nextYDoc.on('update', handleDocUpdate);

    socket.connect();

    return () => {
      // Remove our update listener but do NOT destroy the shared Y.Doc
      // because other hook instances or components may still rely on the same document.
      try {
        const debugDoc = nextYDoc as Y.Doc & { guid?: string | number; clientID?: string | number };
         
        console.warn('[Yjs] Removing update listener from Y.Doc', debugDoc.guid ?? debugDoc.clientID);
      } catch {
        // ignore
      }
      nextYDoc.off('update', handleDocUpdate);
      socket.emit('note:leave');
      socket.disconnect();
      syncedSocketIdRef.current = null;
      socketRef.current = null;
      setIsConnected(false);
      setCollaborators([]);
      setPresenceParticipants([]);
      setTypingParticipants([]);
      setYDoc(null);
      setIsSynced(false);
    };
  }, [accessToken, enabled, noteId, refreshToken, user, unlockToken]);

  const sendContentUpdate = (content?: string | undefined, title?: string | undefined, metadata?: { title?: string | undefined; isPinned?: boolean | undefined; isProtected?: boolean | undefined; labels?: string[] | undefined }) => {
    if (socketRef.current?.connected && noteId) {
      socketRef.current.emit('note:update', { noteId, content, title, ...metadata });
    }
  };

  const sendTypingState = (isTyping: boolean) => {
    if (socketRef.current?.connected && noteId) {
      socketRef.current.emit(NOTE_COLLABORATION_EVENTS.typing, { noteId, isTyping });
    }
  };

  return {
    collaborators,
    presenceParticipants,
    typingParticipants,
    isConnected,
    yDoc,
    isSynced,
    sendContentUpdate,
    sendTypingState,
    sendDelete: () => {
      if (socketRef.current?.connected && noteId) {
        socketRef.current.emit('note:delete', { noteId });
      }
    },
  };
}
