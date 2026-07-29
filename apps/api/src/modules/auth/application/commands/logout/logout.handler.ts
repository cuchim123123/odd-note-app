import { Inject } from '@nestjs/common';
import { CommandHandler } from '@nestjs/cqrs';
import type { ICommandHandler } from '@nestjs/cqrs';
import { TOKEN_PROVIDER } from '@modules/auth/application/ports/token-provider.port';
import type { TokenProvider } from '@modules/auth/application/ports/token-provider.port';
import { UNIT_OF_WORK, type UnitOfWork } from '@modules/auth/application/ports/unit-of-work.port';
import { LogoutCommand } from '@modules/auth/application/commands/logout/logout.command';

@CommandHandler(LogoutCommand)
export class LogoutHandler implements ICommandHandler<LogoutCommand> {
  constructor(
    @Inject(TOKEN_PROVIDER) private readonly tokenProvider: TokenProvider,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: UnitOfWork,
  ) {}

  async execute(command: LogoutCommand): Promise<void> {
    this.tokenProvider.verifyRefreshToken(command.refreshToken);
    const tokenHash = this.tokenProvider.hashToken(command.refreshToken);

    await this.unitOfWork.execute(async ({ repos }) => {
      const tokenRecord = await repos.token.findRefreshToken(tokenHash);
      if (tokenRecord) {
        const revokedToken = tokenRecord.revoke();
        await repos.token.saveRefreshToken(revokedToken);
      }
    });
  }
}
