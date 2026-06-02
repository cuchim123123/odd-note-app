import { Injectable } from '@nestjs/common';
import type { PrismaTransactionClient } from './prisma-client.type';
import type { UserRepository } from '../../application/ports/user.repository.port';
import type { User } from '../../domain/entities/user.entity';
import { AuthUserMapper } from '../mappers/auth-user.mapper';

@Injectable()
export class PrismaUserRepository implements UserRepository {
  constructor(private readonly prisma: PrismaTransactionClient) {}

  async findById(id: string): Promise<User | null> {
    const raw = await this.prisma.user.findUnique({ where: { id } });
    return raw ? AuthUserMapper.toDomain(raw) : null;
  }

  async findByEmail(email: string): Promise<User | null> {
    const raw = await this.prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    return raw ? AuthUserMapper.toDomain(raw) : null;
  }

  async create(data: { email: string; displayName: string; passwordHash: string }): Promise<User> {
    const raw = await this.prisma.user.create({ data: { ...data, email: data.email.toLowerCase() } });
    return AuthUserMapper.toDomain(raw);
  }

  async update(
    id: string,
    data: {
      displayName?: string;
      avatarUrl?: string | null;
      passwordHash?: string;
      isEmailVerified?: boolean;
    },
  ): Promise<User> {
    const raw = await this.prisma.user.update({ where: { id }, data });
    return AuthUserMapper.toDomain(raw);
  }
}
