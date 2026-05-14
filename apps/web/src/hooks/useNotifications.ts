import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/axios';
import type { NotificationListResponse, UnreadCountResponse } from '../types/notification';

const NOTIFICATIONS_KEY = 'notifications';

export const useNotifications = () => {
  return useQuery({
    queryKey: [NOTIFICATIONS_KEY],
    queryFn: async (): Promise<NotificationListResponse> => {
      const { data } = await api.get('/notifications');
      return data;
    },
    staleTime: 30 * 1000, // 30 seconds
  });
};

export const useUnreadNotificationCount = () => {
  return useQuery({
    queryKey: [NOTIFICATIONS_KEY, 'unread-count'],
    queryFn: async (): Promise<UnreadCountResponse> => {
      const { data } = await api.get('/notifications/unread-count');
      return data;
    },
    staleTime: 10 * 1000, // 10 seconds
    refetchInterval: 30 * 1000, // Refetch every 30 seconds
  });
};

export const useMarkNotificationAsRead = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (notificationId: string) => {
      const { data } = await api.post(`/notifications/${notificationId}/read`);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [NOTIFICATIONS_KEY] });
    },
  });
};

export const useMarkAllNotificationsAsRead = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const { data } = await api.post('/notifications/read-all');
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [NOTIFICATIONS_KEY] });
    },
  });
};

export const useDeleteNotification = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (notificationId: string) => {
      const { data } = await api.delete(`/notifications/${notificationId}`);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [NOTIFICATIONS_KEY] });
    },
  });
};
