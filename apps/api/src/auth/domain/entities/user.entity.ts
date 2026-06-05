import { InvalidCredentialsError } from '../errors/auth-error';
import * as crypto from 'crypto';

export class User {
  constructor(
    public readonly id: string,
    public readonly email: string,
    public readonly displayName: string,
    public readonly passwordHash: string,
    public readonly role: 'USER' | 'ADMIN',
    public readonly isEmailVerified: boolean,
    public readonly avatarUrl: string | null,
    public readonly createdAt: Date,
    public readonly updatedAt: Date,
  ) {}

  public static create(email: string, displayName: string, passwordHash: string): User {
    return new User(
      crypto.randomUUID(),
      email.toLowerCase(),
      displayName,
      passwordHash,
      'USER',
      false,
      null,
      new Date(),
      new Date(),
    );
  }

  verifyEmail(): User {
    return new User(
      this.id,
      this.email,
      this.displayName,
      this.passwordHash,
      this.role,
      true,
      this.avatarUrl,
      this.createdAt,
      new Date(),
    );
  }

  updateProfile(displayName?: string, avatarUrl?: string | null): User {
    return new User(
      this.id,
      this.email,
      displayName ? displayName.trim() : this.displayName,
      this.passwordHash,
      this.role,
      this.isEmailVerified,
      avatarUrl !== undefined ? avatarUrl : this.avatarUrl,
      this.createdAt,
      new Date(),
    );
  }

  changePassword(newPasswordHash: string): User {
    return new User(
      this.id,
      this.email,
      this.displayName,
      newPasswordHash,
      this.role,
      this.isEmailVerified,
      this.avatarUrl,
      this.createdAt,
      new Date(),
    );
  }

  async authenticate(password: string, hasher: { compare: (plain: string, hashed: string) => Promise<boolean> }): Promise<void> {
    const isValid = await hasher.compare(password, this.passwordHash);
    if (!isValid) {
      throw new InvalidCredentialsError();
    }
  }
}
