import { InvalidCredentialsError, IncorrectPasswordError } from '../errors/auth-error';
import * as crypto from 'crypto';
import { AggregateRoot } from '../../../../shared/domain/ddd/aggregate-root';
import { EmailAddress } from '../value-objects/email-address';
import { UserRegisteredDomainEvent } from '../events/user-registered.domain-event';

export class User extends AggregateRoot {
  constructor(
    public readonly id: string,
    public readonly email: EmailAddress,
    public displayName: string,
    public passwordHash: string,
    public isEmailVerified: boolean,
    public avatarUrl: string | null,
    public readonly createdAt: Date,
    public updatedAt: Date,
  ) {
    super();
  }

  public static create(email: string, displayName: string, passwordHash: string): User {
    const emailAddress = EmailAddress.create(email);
    const user = new User(
      crypto.randomUUID(),
      emailAddress,
      displayName,
      passwordHash,
      false,
      null,
      new Date(),
      new Date(),
    );
    
    user.addDomainEvent(new UserRegisteredDomainEvent(user.id, user.email.value));
    return user;
  }

  verifyEmail(): this {
    this.isEmailVerified = true;
    this.updatedAt = new Date();
    // this.addDomainEvent(new EmailVerifiedDomainEvent(this.id)); // If added later
    return this;
  }

  updateProfile(displayName?: string, avatarUrl?: string | null): this {
    if (displayName) this.displayName = displayName.trim();
    if (avatarUrl !== undefined) this.avatarUrl = avatarUrl;
    this.updatedAt = new Date();
    return this;
  }

  changePassword(newPasswordHash: string): this {
    this.passwordHash = newPasswordHash;
    this.updatedAt = new Date();
    return this;
  }

  async authenticate(password: string, hasher: { compare: (plain: string, hashed: string) => Promise<boolean> }): Promise<void> {
    const isValid = await hasher.compare(password, this.passwordHash);
    if (!isValid) {
      throw new InvalidCredentialsError();
    }
  }

  async verifyCurrentPassword(password: string, hasher: { compare: (plain: string, hashed: string) => Promise<boolean> }): Promise<void> {
    const isValid = await hasher.compare(password, this.passwordHash);
    if (!isValid) {
      throw new IncorrectPasswordError();
    }
  }
}
