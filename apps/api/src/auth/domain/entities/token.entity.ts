import { TokenAlreadyUsedError, TokenExpiredError, InvalidTokenError } from '../errors/auth-error';

export abstract class Token {
  constructor(
    public readonly id: string,
    public readonly tokenHash: string,
    public readonly userId: string,
    public readonly expiresAt: Date,
    public readonly createdAt: Date,
  ) {}

  public isExpired(): boolean {
    return new Date() > this.expiresAt;
  }
}

export class VerificationToken extends Token {
  constructor(
    id: string,
    tokenHash: string,
    userId: string,
    expiresAt: Date,
    public readonly usedAt: Date | null,
    createdAt: Date,
  ) {
    super(id, tokenHash, userId, expiresAt, createdAt);
  }

  public consume(): VerificationToken {
    if (this.isExpired()) {
      throw new TokenExpiredError();
    }
    if (this.usedAt) {
      throw new TokenAlreadyUsedError('Verification token has already been used');
    }

    return new VerificationToken(
      this.id,
      this.tokenHash,
      this.userId,
      this.expiresAt,
      new Date(),
      this.createdAt,
    );
  }
}

export class PasswordResetToken extends Token {
  constructor(
    id: string,
    tokenHash: string,
    userId: string,
    expiresAt: Date,
    public readonly usedAt: Date | null,
    createdAt: Date,
  ) {
    super(id, tokenHash, userId, expiresAt, createdAt);
  }

  public consume(): PasswordResetToken {
    if (this.isExpired()) {
      throw new TokenExpiredError('This password reset link has expired');
    }
    if (this.usedAt) {
      throw new TokenAlreadyUsedError('This password reset link has already been used');
    }

    return new PasswordResetToken(
      this.id,
      this.tokenHash,
      this.userId,
      this.expiresAt,
      new Date(),
      this.createdAt,
    );
  }
}

export class RefreshToken extends Token {
  constructor(
    id: string,
    tokenHash: string,
    userId: string,
    expiresAt: Date,
    public readonly revokedAt: Date | null,
    createdAt: Date,
  ) {
    super(id, tokenHash, userId, expiresAt, createdAt);
  }

  public revoke(): RefreshToken {
    if (this.revokedAt) {
      // Already revoked, idempotent
      return this;
    }
    return new RefreshToken(
      this.id,
      this.tokenHash,
      this.userId,
      this.expiresAt,
      new Date(),
      this.createdAt,
    );
  }

  public consume(): RefreshToken {
    if (this.isExpired() || this.revokedAt) {
      throw new InvalidTokenError();
    }
    // Consuming a refresh token means revoking it so it can't be used again
    return this.revoke();
  }
}
