import { useEffect, useRef } from 'react';
import * as Y from 'yjs';
import * as awarenessProtocol from 'y-protocols/awareness';
import { io, Socket } from 'socket.io-client';
import { useAuthStore } from '../../../stores/auth.store';

export type RemoteCursorState = {
  userId: string;
  displayName: string;
  color: string;
  position: number;
  selection?: { anchor: number; head: number };
};

export type UseYjsCollaborationOptions = {
  noteId: string;
  onUpdate?: (update: number[]) => void;
  onAwarenessUpdate?: (states: RemoteCursorState[]) => void;
};

export function useYjsCollaboration({
  noteId,
  onUpdate,
  onAwarenessUpdate,
}: UseYjsCollaborationOptions) {
  const socketRef = useRef<Socket | null>(null);
  const yDocRef = useRef<Y.Doc | null>(null);
  const awarenessRef = useRef<awarenessProtocol.Awareness | null>(null);
  const pendingSyncRef = useRef<boolean>(false);
  const user = useAuthStore((state) => state.user);

  useEffect(() => {
    if (!noteId || !user) {
      return;
    }

    // Initialize Yjs document
    const yDoc = new Y.Doc();
    yDocRef.current = yDoc;

    // Initialize awareness
    const awareness = new awarenessProtocol.Awareness(yDoc);
    awarenessRef.current = awareness;

    // Create Socket.IO connection
    const socket = io(
      process.env.VITE_API_URL || `http://${window.location.hostname}:4000`,
      {
        auth: {
          token: localStorage.getItem('accessToken') || '',
        },
        query: {
          token: localStorage.getItem('accessToken') || '',
        },
        namespace: '/collaboration',
      }
    );
    socketRef.current = socket;

    socket.on('connect', () => {
      // Request full document state from server
      const sv = Y.encodeStateVector(yDoc);
      socket.emit('yjs:sync-step-1', {
        noteId,
        stateVector: Array.from(sv),
      });
      pendingSyncRef.current = false;
    });

    socket.on('yjs:sync-step-2', (data: { noteId: string; update: number[] }) => {
      if (data.noteId === noteId) {
        // Apply server's document state
        Y.applyUpdate(yDoc, new Uint8Array(data.update));
        pendingSyncRef.current = false;
      }
    });

    socket.on('yjs:update', (data: { noteId: string; update: number[] }) => {
      if (data.noteId === noteId) {
        // Apply remote update
        Y.applyUpdate(yDoc, new Uint8Array(data.update));
      }
    });

    socket.on('yjs:awareness:update', (data: { noteId: string; states: RemoteCursorState[] }) => {
      if (data.noteId === noteId && onAwarenessUpdate) {
        onAwarenessUpdate(data.states);
      }
    });

    // Listen to local document changes
    const updateHandler = (update: Uint8Array) => {
      if (!pendingSyncRef.current) {
        pendingSyncRef.current = true;
        // Send update to server
        socket.emit('yjs:update', {
          noteId,
          update: Array.from(update),
        });
        if (onUpdate) {
          onUpdate(Array.from(update));
        }
      }
    };

    yDoc.on('update', updateHandler);

    // Listen to awareness changes
    const awarenessUpdateHandler = () => {
      if (onAwarenessUpdate) {
        const states = Array.from(awareness.getStates().values()) as RemoteCursorState[];
        onAwarenessUpdate(states);
      }
    };

    awareness.on('update', awarenessUpdateHandler);

    return () => {
      yDoc.off('update', updateHandler);
      awareness.off('update', awarenessUpdateHandler);
      socket.disconnect();
    };
  }, [noteId, user, onUpdate, onAwarenessUpdate]);

  return {
    yDoc: yDocRef.current,
    awareness: awarenessRef.current,
    socket: socketRef.current,
  };
}
