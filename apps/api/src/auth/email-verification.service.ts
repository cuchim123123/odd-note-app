import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { User } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { VerificationTokenService } from './verification-token.service';
import { MailerService } from '../common/mailer/mailer.service';
import { AuthUrlService } from '../common/auth-url.service';
import { AuthUserMapper } from './auth-user.mapper';
import type { AuthUserProfile } from './auth.types';

@Injectable()
export class EmailVerificationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly verificationTokenService: VerificationTokenService,
    private readonly authUrlService: AuthUrlService,
    private readonly mailerService: MailerService,
    private readonly authUserMapper: AuthUserMapper,
  ) {}

  async createTokenForUser(userId: string, prismaClient?: Prisma.TransactionClient): Promise<string> {
    return this.verificationTokenService.createAndStoreVerificationToken(userId, prismaClient);
  }

  async sendVerificationForUser(user: User, token: string): Promise<void> {
    const verificationUrl = this.authUrlService.buildVerificationEmailUrl(token);

    await this.mailerService.sendVerificationEmail({
      to: user.email,
      displayName: user.displayName,
      verificationUrl,
    });
  }

  async verifyEmailToken(token: string): Promise<{ user: AuthUserProfile }> {
    const userId = await this.verificationTokenService.validateAndUseVerificationToken(token);
    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: { isEmailVerified: true },
    });

    return { user: this.authUserMapper.toProfile(updatedUser) };
  }
}
