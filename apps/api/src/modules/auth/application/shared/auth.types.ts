import type { User } from '@modules/auth/domain/entities/user.entity';



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
