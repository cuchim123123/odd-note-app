import type { UserRepository } from '@modules/auth/application/ports/user.repository.port';
import type { TokenRepository } from '@modules/auth/application/ports/token.repository.port';
import type { OutboxPort } from '@modules/auth/application/ports/outbox.port';

export interface TransactionContext {
  repos: {
    user: UserRepository;
    token: TokenRepository;
  };
  outbox: OutboxPort;
}

export interface UnitOfWork {
  execute<T>(work: (ctx: TransactionContext) => Promise<T>): Promise<T>;
}
export const UNIT_OF_WORK = Symbol('UnitOfWork');
