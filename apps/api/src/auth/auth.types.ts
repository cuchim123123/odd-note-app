import type { UserRole } from '@prisma/client';

export type AuthUserProfile = {
  id: string;
  email: string;
  displayName: string;
  role: UserRole;
  isEmailVerified: boolean;
};

export type AuthTokens = {
  accessToken: string;
  refreshToken: string;
};

export type AuthResult = {
  user: AuthUserProfile;
  tokens: AuthTokens;
};

export type RegisterResult = AuthResult;
export type LoginResult = AuthResult;