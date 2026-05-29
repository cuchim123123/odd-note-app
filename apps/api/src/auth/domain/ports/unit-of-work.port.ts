import type { IUserRepository } from './user.repository.port';
import type { ITokenRepository } from './token.repository.port';

export interface ITransactionContext {
  userRepository: IUserRepository;
  tokenRepository: ITokenRepository;
}

export interface IUnitOfWork {
  runTransaction<T>(work: (ctx: ITransactionContext) => Promise<T>): Promise<T>;
}
export const UNIT_OF_WORK = Symbol('IUnitOfWork');
