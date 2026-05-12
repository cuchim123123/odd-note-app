import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type UserProfile = {
  id: string;
  email: string;
  displayName: string;
  role: 'USER' | 'ADMIN';
  isEmailVerified: boolean;
};

interface AuthState {
  user: UserProfile | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  setAuth: (user: UserProfile, accessToken: string, refreshToken: string) => void;
  setTokens: (accessToken: string, refreshToken: string) => void;
  updateUser: (user: Partial<UserProfile>) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,

      setAuth: (user, accessToken, refreshToken) =>
        set({ user, accessToken, refreshToken, isAuthenticated: true }),

      setTokens: (accessToken, refreshToken) =>
        set({ accessToken, refreshToken }),

      updateUser: (updates) =>
        set((state) => ({
          user: state.user ? { ...state.user, ...updates } : null,
        })),

      logout: () =>
        set({ user: null, accessToken: null, refreshToken: null, isAuthenticated: false }),
    }),
    {
      name: 'odd-note-auth',
      partialize: (state) => ({
        user: state.user,
        refreshToken: state.refreshToken,
        isAuthenticated: state.isAuthenticated,
        // We persist the refreshToken and user profile. 
        // Access token can be regenerated or persisted, but typically safer in memory, 
        // but for simplicity in this frontend we'll let zustand persist it too, 
        // or just rely on the interceptor.
        accessToken: state.accessToken, 
      }),
    }
  )
);
