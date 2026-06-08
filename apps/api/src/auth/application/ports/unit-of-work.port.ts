import type { UserRepository } from './user.repository.port';
import type { TokenRepository } from './token.repository.port';
import type { OutboxPort } from './outbox.port';

export interface TransactionContext {
  userRepository: UserRepository;
  tokenRepository: TokenRepository;
  outbox: OutboxPort;
}

export interface UnitOfWork {
  execute<T>(work: (ctx: TransactionContext) => Promise<T>): Promise<T>;
}
export const UNIT_OF_WORK = Symbol('UnitOfWork');
