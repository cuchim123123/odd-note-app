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

export type AccessTokenPayload = {
  sub?: string;
  type?: string;
};

export type AuthResult = {
  user: AuthUserProfile;
  tokens: AuthTokens;
};

export type RegisterResult = AuthResult;
export type LoginResult = AuthResult;
