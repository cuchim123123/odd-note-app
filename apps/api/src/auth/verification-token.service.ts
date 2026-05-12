import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { createHash, randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { AuthConfigService } from '../config';

@Injectable()
export class VerificationTokenService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authConfig: AuthConfigService,
  ) {}

  private hashToken(rawToken: string): string {
    return createHash('sha256').update(rawToken).digest('hex');
  }

  async createAndStoreVerificationToken(
    userId: string,
    prismaClient?: Prisma.TransactionClient,
  ): Promise<string> {
    const client = prismaClient ?? this.prisma;

    const verificationToken = randomBytes(32).toString('hex');
    const tokenHash = this.hashToken(verificationToken);
    const expiresAt = new Date(Date.now() + this.authConfig.getEmailVerificationTokenExpiryMs());

    await client.verificationToken.create({
      data: {
        tokenHash,
        expiresAt,
        userId,
      },
    });

    return verificationToken;
  }

  async validateAndUseVerificationToken(token: string): Promise<string> {
    const tokenHash = this.hashToken(token);
    return this.prisma.$transaction(async (tx) => {
      const verificationToken = await tx.verificationToken.findUnique({
        where: { tokenHash },
      });

      if (!verificationToken || verificationToken.usedAt || verificationToken.expiresAt < new Date()) {
        throw new BadRequestException('Verification token is invalid or expired');
      }

      const now = new Date();
      const consumeResult = await tx.verificationToken.updateMany({
        where: {
          id: verificationToken.id,
          usedAt: null,
          expiresAt: { gt: now },
        },
        data: { usedAt: now },
      });

      if (consumeResult.count !== 1) {
        throw new BadRequestException('Verification token is invalid or expired');
      }

      return verificationToken.userId;
    });
  }
}
