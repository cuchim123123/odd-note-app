import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { clearAllOfflineData } from '../../notes/api/notes.storage';

export type UserProfile = {
  id: string;
  email: string;
  displayName: string;
  role: 'USER' | 'ADMIN';
  isEmailVerified: boolean;
  avatarUrl: string | null;
};

export interface AuthState {
  user: UserProfile | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  hasHydrated: boolean;
  setAuth: (user: UserProfile, accessToken: string, refreshToken: string) => void;
  setTokens: (accessToken: string, refreshToken: string) => void;
  updateUser: (user: Partial<UserProfile>) => void;
  logout: (clearOffline?: boolean) => void;
  setHasHydrated: (hasHydrated: boolean) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      hasHydrated: false,

      setHasHydrated: (hasHydrated) => set({ hasHydrated }),

      setAuth: (user, accessToken, refreshToken) =>
        set({ user, accessToken, refreshToken, isAuthenticated: true }),

      setTokens: (accessToken, refreshToken) =>
        set({ accessToken, refreshToken }),

      updateUser: (updates) =>
        set((state) => ({
          user: state.user ? { ...state.user, ...updates } : null,
        })),

      logout: (clearOffline = true) => {
        set({ user: null, accessToken: null, refreshToken: null, isAuthenticated: false });
        if (clearOffline) {
          void clearAllOfflineData();
        }
      },
    }),
    {
      name: 'odd-note-auth',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        user: state.user,
        refreshToken: state.refreshToken,
        isAuthenticated: state.isAuthenticated,
        accessToken: state.accessToken,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    }
  )
);
