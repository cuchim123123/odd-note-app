import { Injectable, Inject } from '@nestjs/common';
import { User } from '../../domain/entities/user.entity';
import { VerificationTokenService } from './verification-token.service';
import { MailerService } from '../../../common/mailer/mailer.service';
import { AuthUrlService } from '../../../common/auth-url.service';
import { AuthUserMapper } from '../../infrastructure/mappers/auth-user.mapper';
import type { AuthUserProfile } from '../auth.types';
import { USER_REPOSITORY } from '../ports/user.repository.port';
import type { IUserRepository } from '../ports/user.repository.port';
import type { ITokenRepository } from '../ports/token.repository.port';

@Injectable()
export class EmailVerificationService {
  constructor(
    @Inject(USER_REPOSITORY) private readonly userRepo: IUserRepository,
    private readonly verificationTokenService: VerificationTokenService,
    private readonly authUrlService: AuthUrlService,
    private readonly mailerService: MailerService,
    private readonly authUserMapper: AuthUserMapper,
  ) {}

  async createTokenForUser(userId: string, tokenRepo?: ITokenRepository): Promise<string> {
    return this.verificationTokenService.createAndStoreVerificationToken(userId, tokenRepo);
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
    const updatedUser = await this.userRepo.update(userId, { isEmailVerified: true });

    return { user: this.authUserMapper.toProfile(updatedUser) };
  }

  async resendVerificationEmail(email: string): Promise<void> {
    const user = await this.userRepo.findByEmail(email);

    if (!user || user.isEmailVerified) {
      return;
    }

    const token = await this.createTokenForUser(user.id);
    await this.sendVerificationForUser(user, token);
  }
}
