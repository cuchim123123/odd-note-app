import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../prisma/prisma.service';
import type { UnitOfWork, TransactionContext } from '../../../application/ports/unit-of-work.port';
import { PrismaUserRepository } from './prisma-user.repository';
import { PrismaTokenRepository } from './prisma-token.repository';

import type { PrismaTransactionClient } from './prisma-client.type';

@Injectable()
export class PrismaUnitOfWork implements UnitOfWork {
  constructor(private readonly prisma: PrismaService) {}

  async execute<T>(work: (ctx: TransactionContext) => Promise<T>): Promise<T> {
    return this.prisma.$transaction(async (tx: PrismaTransactionClient) => {
      const ctx: TransactionContext = {
        userRepository: new PrismaUserRepository(tx),
        tokenRepository: new PrismaTokenRepository(tx),
      };
      return work(ctx);
    });
  }
}
