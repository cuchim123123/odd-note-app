import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import type { IUnitOfWork, ITransactionContext } from '../../application/ports/unit-of-work.port';
import { PrismaUserRepository } from './prisma-user.repository';
import { PrismaTokenRepository } from './prisma-token.repository';

@Injectable()
export class PrismaUnitOfWork implements IUnitOfWork {
  constructor(private readonly prisma: PrismaService) {}

  async execute<T>(work: (ctx: ITransactionContext) => Promise<T>): Promise<T> {
    return this.prisma.$transaction(async (tx) => {
      const ctx: ITransactionContext = {
        userRepository: new PrismaUserRepository(tx),
        tokenRepository: new PrismaTokenRepository(tx),
      };
      return work(ctx);
    });
  }
}
