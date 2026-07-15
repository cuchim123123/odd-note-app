import { Injectable, Inject, Optional } from '@nestjs/common';
import { PrismaService } from '@infrastructure/prisma/prisma.service';
import type { PrismaTransactionClient } from '@modules/auth/infrastructure/persistence/prisma-client.type';
import type { UserRepository } from '@modules/auth/application/ports/user.repository.port';
import type { User } from '@modules/auth/domain/entities/user.entity';
import { UserPersistenceMapper } from '@modules/auth/infrastructure/persistence/mappers/user-persistence.mapper';
import { UserAlreadyExistsError } from '@modules/auth/domain/errors/auth-error';
import type { AggregateTracker } from '@shared/domain/ddd/aggregate-tracker';

@Injectable()
export class PrismaUserRepository implements UserRepository {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaTransactionClient,
    @Optional() @Inject('AGGREGATE_TRACKER') private readonly tracker?: AggregateTracker
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
          isEmailVerified: user.isEmailVerified,
          avatarUrl: user.avatarUrl,
          updatedAt: user.updatedAt,
        },
        create: {
          id: user.id,
          email: user.email.value,
          displayName: user.displayName,
          passwordHash: user.passwordHash,
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
