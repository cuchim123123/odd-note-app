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
    const verificationToken = await this.prisma.verificationToken.findUnique({
      where: { tokenHash },
    });

    if (!verificationToken) {
      throw new BadRequestException('Verification token is invalid or expired');
    }

    if (verificationToken.usedAt) {
      throw new BadRequestException('Verification token is invalid or expired');
    }

    if (verificationToken.expiresAt < new Date()) {
      throw new BadRequestException('Verification token is invalid or expired');
    }

    await this.prisma.verificationToken.update({
      where: { id: verificationToken.id },
      data: { usedAt: new Date() },
    });

    return verificationToken.userId;
  }
}
