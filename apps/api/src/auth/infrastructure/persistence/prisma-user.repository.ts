import { Injectable } from '@nestjs/common';
import type { PrismaTransactionClient } from './prisma-client.type';
import type { UserRepository } from '../../application/ports/user.repository.port';
import type { User } from '../../domain/entities/user.entity';
import { UserPersistenceMapper } from './mappers/user-persistence.mapper';

@Injectable()
export class PrismaUserRepository implements UserRepository {
  constructor(private readonly prisma: PrismaTransactionClient) {}

  async findById(id: string): Promise<User | null> {
    const raw = await this.prisma.user.findUnique({ where: { id } });
    return raw ? UserPersistenceMapper.toDomain(raw) : null;
  }

  async findByEmail(email: string): Promise<User | null> {
    const raw = await this.prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    return raw ? UserPersistenceMapper.toDomain(raw) : null;
  }

  async create(data: { email: string; displayName: string; passwordHash: string }): Promise<User> {
    const raw = await this.prisma.user.create({ data: { ...data, email: data.email.toLowerCase() } });
    return UserPersistenceMapper.toDomain(raw);
  }

  async save(user: User): Promise<void> {
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        email: user.email,
        displayName: user.displayName,
        passwordHash: user.passwordHash,
        role: user.role,
        isEmailVerified: user.isEmailVerified,
        avatarUrl: user.avatarUrl,
        updatedAt: user.updatedAt,
      },
    });
  }
}
