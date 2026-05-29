import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import type { IUserRepository } from '../../domain/ports/user.repository.port';
import { User } from '../../domain/entities/user.entity';
import { AuthUserMapper } from '../mappers/auth-user.mapper';
import { txStorage } from './tx-storage';

@Injectable()
export class PrismaUserRepository implements IUserRepository {
  constructor(private readonly prisma: PrismaService) {}

  private getClient() {
    return txStorage.getStore() ?? this.prisma;
  }

  async findById(id: string): Promise<User | null> {
    const raw = await this.getClient().user.findUnique({ where: { id } });
    return raw ? AuthUserMapper.toDomain(raw) : null;
  }

  async findByEmail(email: string): Promise<User | null> {
    const raw = await this.getClient().user.findUnique({ where: { email: email.toLowerCase() } });
    return raw ? AuthUserMapper.toDomain(raw) : null;
  }

  async create(data: { email: string; displayName: string; passwordHash: string }): Promise<User> {
    const raw = await this.getClient().user.create({ data: { ...data, email: data.email.toLowerCase() } });
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
    const raw = await this.getClient().user.update({ where: { id }, data });
    return AuthUserMapper.toDomain(raw);
  }

  async runTransaction<T>(callback: () => Promise<T>): Promise<T> {
    return this.prisma.$transaction(async (tx) => {
      return txStorage.run(tx, callback);
    });
  }
}
