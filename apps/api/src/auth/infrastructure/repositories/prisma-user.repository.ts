import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import type { IUserRepository } from '../../domain/ports/user.repository.port';
import type { User } from '@prisma/client';

@Injectable()
export class PrismaUserRepository implements IUserRepository {
  constructor(private readonly prisma: PrismaService) {}

  private getClient(tx?: unknown) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (tx as any) ?? this.prisma;
  }

  async findById(id: string, tx?: unknown): Promise<User | null> {
    return this.getClient(tx).user.findUnique({ where: { id } });
  }

  async findByEmail(email: string, tx?: unknown): Promise<User | null> {
    return this.getClient(tx).user.findUnique({ where: { email: email.toLowerCase() } });
  }

  async create(data: { email: string; displayName: string; passwordHash: string }, tx?: unknown): Promise<User> {
    return this.getClient(tx).user.create({ data: { ...data, email: data.email.toLowerCase() } });
  }

  async update(id: string, data: { displayName?: string; avatarUrl?: string | null; passwordHash?: string; isEmailVerified?: boolean }, tx?: unknown): Promise<User> {
    return this.getClient(tx).user.update({ where: { id }, data });
  }

  async runTransaction<T>(callback: (tx: unknown) => Promise<T>): Promise<T> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return this.prisma.$transaction(callback as any) as Promise<T>;
  }
}
