import { Inject } from '@nestjs/common';
import { CommandHandler } from '@nestjs/cqrs';
import type { ICommandHandler } from '@nestjs/cqrs';
import { TOKEN_PROVIDER } from '@modules/auth/application/ports/token-provider.port';
import type { TokenProvider } from '@modules/auth/application/ports/token-provider.port';
import { USER_REPOSITORY } from '@modules/auth/application/ports/user.repository.port';
import type { UserRepository } from '@modules/auth/application/ports/user.repository.port';
import { UNIT_OF_WORK } from '@modules/auth/application/ports/unit-of-work.port';
import type { UnitOfWork } from '@modules/auth/application/ports/unit-of-work.port';
import { ResendVerificationCommand } from '@modules/auth/application/commands/resend-verification/resend-verification.command';
import { VerificationToken } from '@modules/auth/domain/entities/token.entity';

@CommandHandler(ResendVerificationCommand)
export class ResendVerificationHandler implements ICommandHandler<ResendVerificationCommand> {
  constructor(
    @Inject(TOKEN_PROVIDER) private readonly tokenProvider: TokenProvider,
    @Inject(USER_REPOSITORY) private readonly userRepo: UserRepository,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
  ) {}

  async execute(command: ResendVerificationCommand): Promise<void> {
    const user = await this.userRepo.findByEmail(command.email);

    if (!user || user.isEmailVerified) {
      return;
    }

    const { rawToken, tokenHash, expiresAt } = this.tokenProvider.generateVerificationToken();

    const token = VerificationToken.create(tokenHash, user.id, expiresAt);

    await this.unitOfWork.execute(async (ctx) => {
      await ctx.tokenRepository.saveVerificationToken(token);
      
      await ctx.outbox.scheduleInternalCommand('SendVerificationEmail', {
        email: user.email.value,
        displayName: user.displayName,
        verificationToken: rawToken,
      });
    });
  }
}
