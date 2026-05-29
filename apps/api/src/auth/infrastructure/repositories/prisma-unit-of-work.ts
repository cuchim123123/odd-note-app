import { Injectable, Inject } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import type { IUnitOfWork } from '../../domain/ports/unit-of-work.port';
import { USER_REPOSITORY } from '../../domain/ports/user.repository.port';
import type { IUserRepository } from '../../domain/ports/user.repository.port';
import { TOKEN_REPOSITORY } from '../../domain/ports/token.repository.port';
import type { ITokenRepository } from '../../domain/ports/token.repository.port';
import { txStorage } from './tx-storage';

@Injectable()
export class PrismaUnitOfWork implements IUnitOfWork {
  constructor(
    @Inject(USER_REPOSITORY) public readonly userRepository: IUserRepository,
    @Inject(TOKEN_REPOSITORY) public readonly tokenRepository: ITokenRepository,
    private readonly prisma: PrismaService,
  ) {}

  async runTransaction<T>(work: () => Promise<T>): Promise<T> {
    return this.prisma.$transaction(async (tx) => {
      return txStorage.run(tx, work);
    });
  }
}
