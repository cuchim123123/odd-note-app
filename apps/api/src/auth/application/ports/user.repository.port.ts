import type { User } from '../../domain/entities/user.entity';

export interface UserRepository {
  findById(id: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  create(data: { email: string; displayName: string; passwordHash: string }): Promise<User>;
  update(
    id: string,
    data: {
      displayName?: string;
      avatarUrl?: string | null;
      passwordHash?: string;
      isEmailVerified?: boolean;
    },
  ): Promise<User>;
}
export const USER_REPOSITORY = Symbol('UserRepository');
