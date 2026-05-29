import type { User } from '../entities/user.entity';

export interface IUserRepository {
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
  runTransaction<T>(callback: () => Promise<T>): Promise<T>;
}
export const USER_REPOSITORY = Symbol('IUserRepository');
