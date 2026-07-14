import type { VerificationToken, PasswordResetToken, RefreshToken } from '../../domain/entities/token.entity';

export interface TokenRepository {
  // Verification tokens
  saveVerificationToken(token: VerificationToken): Promise<void>;
  findVerificationToken(tokenHash: string): Promise<VerificationToken | null>;

  // Password reset tokens
  saveResetToken(token: PasswordResetToken): Promise<void>;
  findResetToken(tokenHash: string): Promise<PasswordResetToken | null>;

  // Refresh tokens
  saveRefreshToken(token: RefreshToken): Promise<void>;
  findRefreshToken(tokenHash: string): Promise<RefreshToken | null>;

  // Cleanup (Infrastructure concern)
  deleteExpiredOrUsedTokens(now: Date): Promise<{ refreshCount: number; verificationCount: number; resetCount: number }>;
}
export const TOKEN_REPOSITORY = Symbol('TokenRepository');
