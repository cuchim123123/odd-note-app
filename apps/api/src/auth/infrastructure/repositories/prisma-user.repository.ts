import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import type { IUserRepository } from '../../domain/ports/user.repository.port';
import { User } from '../../domain/entities/user.entity';
import { AuthUserMapper } from '../../auth-user.mapper';

@Injectable()
export class PrismaUserRepository implements IUserRepository {
  constructor(private readonly prisma: PrismaService) {}

  private getClient(tx?: unknown) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (tx as any) ?? this.prisma;
  }

  async findById(id: string, tx?: unknown): Promise<User | null> {
    const raw = await this.getClient(tx).user.findUnique({ where: { id } });
    return raw ? AuthUserMapper.toDomain(raw) : null;
  }

  async findByEmail(email: string, tx?: unknown): Promise<User | null> {
    const raw = await this.getClient(tx).user.findUnique({ where: { email: email.toLowerCase() } });
    return raw ? AuthUserMapper.toDomain(raw) : null;
  }

  async create(data: { email: string; displayName: string; passwordHash: string }, tx?: unknown): Promise<User> {
    const raw = await this.getClient(tx).user.create({ data: { ...data, email: data.email.toLowerCase() } });
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
    tx?: unknown,
  ): Promise<User> {
    const raw = await this.getClient(tx).user.update({ where: { id }, data });
    return AuthUserMapper.toDomain(raw);
  }

  async runTransaction<T>(callback: (tx: unknown) => Promise<T>): Promise<T> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return this.prisma.$transaction(callback as any) as Promise<T>;
  }
}
