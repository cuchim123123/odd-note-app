import { Inject } from '@nestjs/common';
import { CommandHandler } from '@nestjs/cqrs';
import type { ICommandHandler } from '@nestjs/cqrs';
import { TOKEN_PROVIDER } from '../../ports/token-provider.port';
import type { TokenProvider } from '../../ports/token-provider.port';
import { TOKEN_REPOSITORY } from '../../ports/token.repository.port';
import type { TokenRepository } from '../../ports/token.repository.port';
import { USER_REPOSITORY } from '../../ports/user.repository.port';
import type { UserRepository } from '../../ports/user.repository.port';
import { PasswordResetToken } from '../../../domain/entities/token.entity';
import { GenerateTestResetTokenCommand } from './generate-test-reset-token.command';

@CommandHandler(GenerateTestResetTokenCommand)
export class GenerateTestResetTokenHandler implements ICommandHandler<GenerateTestResetTokenCommand> {
  constructor(
    @Inject(USER_REPOSITORY) private readonly userRepo: UserRepository,
    @Inject(TOKEN_PROVIDER) private readonly tokenProvider: TokenProvider,
    @Inject(TOKEN_REPOSITORY) private readonly tokenRepo: TokenRepository,
  ) {}

  async execute(command: GenerateTestResetTokenCommand): Promise<{ token?: string }> {
    const user = await this.userRepo.findByEmail(command.email);
    if (!user) {
      return {};
    }

    const { rawToken, tokenHash, expiresAt } = this.tokenProvider.generatePasswordResetToken();
    const tokenEntity = PasswordResetToken.create(tokenHash, user.id, expiresAt);
    await this.tokenRepo.saveResetToken(tokenEntity);
    
    return { token: rawToken };
  }
}
