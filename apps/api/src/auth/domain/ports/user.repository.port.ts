import type { User } from '@prisma/client';

export interface IUserRepository {
  findById(id: string, tx?: unknown): Promise<User | null>;
  findByEmail(email: string, tx?: unknown): Promise<User | null>;
  create(data: { email: string; displayName: string; passwordHash: string }, tx?: unknown): Promise<User>;
  update(id: string, data: { displayName?: string; avatarUrl?: string | null; passwordHash?: string }, tx?: unknown): Promise<User>;
  runTransaction<T>(callback: (transactionClient: unknown) => Promise<T>): Promise<T>;
}
export const USER_REPOSITORY = Symbol('IUserRepository');
