import { useMutation } from '@tanstack/react-query';
import { api } from '../../../lib/axios';
import { useAuthStore, type UserProfile } from '../stores/auth.store';

export type UpdateProfileInput = {
  displayName?: string;
  avatarUrl?: string | null;
};

/**
 * Mutation hook to update the user's profile details.
 */
export const useUpdateProfile = () => {
  const updateUser = useAuthStore((state) => state.updateUser);

  return useMutation({
    mutationFn: async (data: UpdateProfileInput) => {
      const response = await api.patch<UserProfile>('/auth/profile', data);
      return response.data;
    },
    onSuccess: (data) => {
      updateUser(data);
    },
  });
};

/**
 * Mutation hook to upload a profile avatar image to S3/MinIO.
 */
export const useUploadAvatar = () => {
  return useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      const response = await api.post<{ url: string; signedUrl: string; key: string }>('/uploads', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      return response.data;
    },
  });
};
