import type { IUserRepository } from './user.repository.port';
import type { ITokenRepository } from './token.repository.port';

export interface IUnitOfWork {
  userRepository: IUserRepository;
  tokenRepository: ITokenRepository;
  runTransaction<T>(work: () => Promise<T>): Promise<T>;
}
export const UNIT_OF_WORK = Symbol('IUnitOfWork');
