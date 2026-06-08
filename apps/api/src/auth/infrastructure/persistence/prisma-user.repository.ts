import { Injectable } from '@nestjs/common';
import type { PrismaTransactionClient } from './prisma-client.type';
import type { UserRepository } from '../../application/ports/user.repository.port';
import type { User } from '../../domain/entities/user.entity';
import { UserPersistenceMapper } from './mappers/user-persistence.mapper';
import { UserAlreadyExistsError } from '../../domain/errors/auth-error';
import type { AggregateTracker } from './aggregate-tracker';

@Injectable()
export class PrismaUserRepository implements UserRepository {
  constructor(
    private readonly prisma: PrismaTransactionClient,
    private readonly tracker?: AggregateTracker
  ) {}

  async findById(id: string): Promise<User | null> {
    const raw = await this.prisma.user.findUnique({ where: { id } });
    return raw ? UserPersistenceMapper.toDomain(raw) : null;
  }

  async findByEmail(email: string): Promise<User | null> {
    const raw = await this.prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    return raw ? UserPersistenceMapper.toDomain(raw) : null;
  }

  async save(user: User): Promise<void> {
    if (this.tracker) {
      this.tracker.track(user);
    }
    try {
      await this.prisma.user.upsert({
        where: { id: user.id },
        update: {
          email: user.email.value,
          displayName: user.displayName,
          passwordHash: user.passwordHash,
          role: user.role,
          isEmailVerified: user.isEmailVerified,
          avatarUrl: user.avatarUrl,
          updatedAt: user.updatedAt,
        },
        create: {
          id: user.id,
          email: user.email.value,
          displayName: user.displayName,
          passwordHash: user.passwordHash,
          role: user.role,
          isEmailVerified: user.isEmailVerified,
          avatarUrl: user.avatarUrl,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
        },
      });
    } catch (err: unknown) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if ((err as any)?.code === 'P2002') {
        throw new UserAlreadyExistsError();
      }
      throw err;
    }
  }
}
