import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import type { IUserRepository } from '../../domain/ports/user.repository.port';
import type { User } from '@prisma/client';

@Injectable()
export class PrismaUserRepository implements IUserRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { id } });
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  }

  async create(data: { email: string; displayName: string; passwordHash: string }): Promise<User> {
    return this.prisma.user.create({ data: { ...data, email: data.email.toLowerCase() } });
  }

  async update(id: string, data: { displayName?: string; avatarUrl?: string | null; passwordHash?: string }): Promise<User> {
    return this.prisma.user.update({ where: { id }, data });
  }

  async runTransaction<T>(callback: (tx: unknown) => Promise<T>): Promise<T> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return this.prisma.$transaction(callback as any) as Promise<T>;
  }
}
