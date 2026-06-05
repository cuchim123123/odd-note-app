import type { User } from '../../domain/entities/user.entity';

/**
 * HTTP response shape — used only by the presentation layer (controller + UserProfileMapper).
 * Lives here as a shared type since both handler return types and controller response shapes reference it.
 */
export type AuthUserProfile = {
  id: string;
  email: string;
  displayName: string;
  role: 'USER' | 'ADMIN';
  isEmailVerified: boolean;
  avatarUrl: string | null;
};

export type AuthTokens = {
  accessToken: string;
  refreshToken: string;
};

/**
 * Command handler return types — carry the domain User entity, not the mapped profile.
 * The controller maps User → AuthUserProfile via UserProfileMapper before sending the HTTP response.
 */
export type AuthResult = {
  user: User;
  tokens: AuthTokens;
};

export type RegisterResult = AuthResult;
export type LoginResult = AuthResult;
