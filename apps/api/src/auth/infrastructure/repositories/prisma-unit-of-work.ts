import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import type { IUnitOfWork, ITransactionContext } from '../../domain/ports/unit-of-work.port';
import { PrismaUserRepository } from './prisma-user.repository';
import { PrismaTokenRepository } from './prisma-token.repository';

@Injectable()
export class PrismaUnitOfWork implements IUnitOfWork {
  constructor(private readonly prisma: PrismaService) {}

  async runTransaction<T>(work: (ctx: ITransactionContext) => Promise<T>): Promise<T> {
    return this.prisma.$transaction(async (tx) => {
      /* eslint-disable @typescript-eslint/no-explicit-any */
      const ctx: ITransactionContext = {
        userRepository: new PrismaUserRepository(tx as any),
        tokenRepository: new PrismaTokenRepository(tx as any),
      };
      /* eslint-enable @typescript-eslint/no-explicit-any */
      return work(ctx);
    });
  }
}
