import { Inject } from '@nestjs/common';
import { CommandHandler } from '@nestjs/cqrs';
import type { ICommandHandler } from '@nestjs/cqrs';
import { TOKEN_PROVIDER } from '@modules/auth/application/ports/token-provider.port';
import type { TokenProvider } from '@modules/auth/application/ports/token-provider.port';
import { TOKEN_REPOSITORY } from '@modules/auth/application/ports/token.repository.port';
import type { TokenRepository } from '@modules/auth/application/ports/token.repository.port';
import { LogoutCommand } from '@modules/auth/application/commands/logout/logout.command';

@CommandHandler(LogoutCommand)
export class LogoutHandler implements ICommandHandler<LogoutCommand> {
  constructor(
    @Inject(TOKEN_PROVIDER) private readonly tokenProvider: TokenProvider,
    @Inject(TOKEN_REPOSITORY) private readonly tokenRepo: TokenRepository,
  ) {}

  async execute(command: LogoutCommand): Promise<void> {
    this.tokenProvider.verifyRefreshToken(command.refreshToken);
    const tokenHash = this.tokenProvider.hashToken(command.refreshToken);

    const tokenRecord = await this.tokenRepo.findRefreshToken(tokenHash);
    if (tokenRecord) {
      const revokedToken = tokenRecord.revoke();
      await this.tokenRepo.saveRefreshToken(revokedToken);
    }
  }
}
