export interface AccessTokenData {
  sub: string;
  displayName: string;
}

/**
 * Represents a generated token ready for persistence.
 * The adapter owns the hashing strategy, expiry policy, and format.
 */
export interface GeneratedToken {
  rawToken: string;
  tokenHash: string;
  expiresAt: Date;
}

export interface TokenProvider {
  // Stateless JWT — no persistence, no hash, no expiry tracking
  signAccessToken(data: AccessTokenData): string;

  // Stateful tokens — adapter produces everything needed for storage
  generateRefreshToken(userId: string): GeneratedToken;
  generateVerificationToken(): GeneratedToken;
  generatePasswordResetToken(): GeneratedToken;

  // Verification — adapter owns the JWT/signature validation
  verifyRefreshToken(rawToken: string): { userId: string };

  // Hash lookup — needed when the use case receives a raw token
  // from the client and must find it in the DB
  hashToken(rawToken: string): string;
}

export const TOKEN_PROVIDER = Symbol('TokenProvider');
