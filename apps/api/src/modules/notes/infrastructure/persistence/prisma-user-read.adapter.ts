import { Injectable, Inject } from '@nestjs/common';
import type { IUserReadPort, UserBasicInfo, UserDisplayInfo } from '../../application/ports/user-read.port';
import { PrismaService } from '../../../../infrastructure/prisma/prisma.service';
import type { PrismaTransactionClient } from './prisma-client.type';

/**
 * Infrastructure adapter: provides read-only user lookups for the Notes module.
 * Uses minimal Prisma `select` projections — never exposes sensitive auth data
 * (password hashes, refresh tokens, verification codes) across module boundaries.
 */
@Injectable()
export class PrismaUserReadAdapter implements IUserReadPort {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaTransactionClient) {}

  async findByEmail(email: string): Promise<UserBasicInfo | null> {
    return this.prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true },
    });
  }

  async findById(id: string): Promise<UserDisplayInfo | null> {
    return this.prisma.user.findUnique({
      where: { id },
      select: { id: true, displayName: true },
    });
  }
}



