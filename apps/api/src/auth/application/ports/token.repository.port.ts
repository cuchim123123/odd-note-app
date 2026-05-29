import type { VerificationToken, PasswordResetToken, RefreshToken } from '../../domain/entities/token.entity';

export interface ITokenRepository {
  // Verification tokens
  createVerificationToken(data: { userId: string; tokenHash: string; expiresAt: Date }): Promise<VerificationToken>;
  findVerificationToken(tokenHash: string): Promise<VerificationToken | null>;
  markVerificationTokenUsed(id: string, now: Date): Promise<{ count: number }>;

  // Password reset tokens
  createResetToken(data: { userId: string; tokenHash: string; expiresAt: Date }): Promise<PasswordResetToken>;
  findResetToken(tokenHash: string): Promise<PasswordResetToken | null>;
  markResetTokenUsed(id: string): Promise<void>;

  // Refresh tokens
  createRefreshToken(data: { userId: string; tokenHash: string; expiresAt: Date }): Promise<RefreshToken>;
  findRefreshToken(tokenHash: string): Promise<RefreshToken | null>;
  revokeRefreshToken(tokenHash: string, revokedAt: Date): Promise<void>;
  updateRefreshTokenRevocation(id: string, revokedAt: Date): Promise<{ count: number }>;

  // Cleanup
  deleteExpiredOrUsedTokens(now: Date): Promise<{ refreshCount: number; verificationCount: number; resetCount: number }>;
}
export const TOKEN_REPOSITORY = Symbol('ITokenRepository');
