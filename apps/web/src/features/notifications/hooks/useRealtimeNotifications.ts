import { useEffect, useRef } from 'react';
import { io, type Socket } from 'socket.io-client';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/features/auth/stores/auth.store';
import { useToast } from '@/components/ui/toast';
import { NOTE_COLLABORATION_NAMESPACE } from '@/features/notes/constants/note-collaboration.constants';
import type { Notification } from '@/types/notification';

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

export function useRealtimeNotifications() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { addToast } = useToast();
  const { accessToken } = useAuthStore();
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!accessToken) {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      return;
    }

    const socket = io(`${getWsUrl()}${NOTE_COLLABORATION_NAMESPACE}`, {
      auth: { token: accessToken },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      console.warn('[RealtimeNotifications] Connected to websocket gateway');
    });

    socket.on('notification:new', (notification: Notification) => {
      console.warn('[RealtimeNotifications] Received realtime notification:', notification);
      
      // 1. Invalidate notifications query to sync the header bell state instantly
      queryClient.invalidateQueries({ queryKey: ['notifications'] });

      // 2. Trigger a beautiful premium toast notification with action if it's a note shared invite
      const noteId = notification.data?.noteId as string | undefined;
      
      interface ToastPayload {
        title?: string;
        message: string;
        type: 'success' | 'error' | 'info' | 'notification';
        duration?: number;
        action?: {
          label: string;
          onClick: () => void;
        };
      }

      const toastPayload: ToastPayload = {
        title: notification.title,
        message: notification.message,
        type: 'notification',
        duration: 8000,
      };

      if (noteId) {
        toastPayload.action = {
          label: 'Join Note',
          onClick: () => {
            navigate(`/notes/${noteId}`);
          }
        };
      }

      addToast(toastPayload);
    });

    socket.on('note:deleted', (data: { noteId: string }) => {
      console.warn('[RealtimeNotifications] Note deleted globally:', data.noteId);
      // Invalidate queries to instantly update the list on the dashboard
      queryClient.invalidateQueries({ queryKey: ['notes'] });
      
      // If currently on this note's page, push back to dashboard immediately
      const currentPath = window.location.pathname;
      if (currentPath === `/notes/${data.noteId}` || currentPath === `/notes/${data.noteId}/`) {
        addToast({
          title: 'Note Deleted',
          message: 'This note was deleted by the owner.',
          type: 'info',
          duration: 5000,
        });
        navigate('/notes');
      }
    });

    socket.on('note:permissions_updated', (data: { noteId: string }) => {
      console.warn('[RealtimeNotifications] Permissions updated globally:', data.noteId);
      queryClient.invalidateQueries({ queryKey: ['notes'] });
      queryClient.invalidateQueries({ queryKey: ['notes', data.noteId] });
      queryClient.invalidateQueries({ queryKey: ['note', data.noteId] });
    });

    socket.on('disconnect', () => {
      console.warn('[RealtimeNotifications] Disconnected from websocket gateway');
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [accessToken, queryClient, navigate, addToast]);
}
