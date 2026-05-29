import type { VerificationToken, PasswordResetToken, RefreshToken } from '@prisma/client';

export interface ITokenRepository {
  // Verification tokens
  createVerificationToken(data: { userId: string; tokenHash: string; expiresAt: Date }, tx?: unknown): Promise<VerificationToken>;
  findVerificationToken(tokenHash: string, tx?: unknown): Promise<VerificationToken | null>;
  markVerificationTokenUsed(id: string, now: Date, tx?: unknown): Promise<{ count: number }>;

  // Password reset tokens
  createResetToken(data: { userId: string; tokenHash: string; expiresAt: Date }): Promise<PasswordResetToken>;
  findResetToken(tokenHash: string): Promise<PasswordResetToken | null>;
  markResetTokenUsed(id: string): Promise<void>;

  // Refresh tokens
  createRefreshToken(data: { userId: string; tokenHash: string; expiresAt: Date }, tx?: unknown): Promise<RefreshToken>;
  findRefreshToken(tokenHash: string, tx?: unknown): Promise<RefreshToken | null>;
  revokeRefreshToken(tokenHash: string, revokedAt: Date): Promise<void>;
  updateRefreshTokenRevocation(id: string, revokedAt: Date, tx?: unknown): Promise<{ count: number }>;

  // Cleanup
  deleteExpiredOrUsedTokens(now: Date): Promise<{ refreshCount: number; verificationCount: number; resetCount: number }>;
}
export const TOKEN_REPOSITORY = Symbol('ITokenRepository');
