import type { User } from '../../domain/entities/user.entity';

export interface UserRepository {
  findById(id: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  create(data: { email: string; displayName: string; passwordHash: string }): Promise<User>;
  save(user: User): Promise<void>;
}
export const USER_REPOSITORY = Symbol('UserRepository');
