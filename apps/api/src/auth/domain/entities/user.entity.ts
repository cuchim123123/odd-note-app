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
}
