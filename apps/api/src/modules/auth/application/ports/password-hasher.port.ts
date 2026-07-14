export interface PasswordHasher {
  hash(plaintext: string): Promise<string>;
  compare(plaintext: string, hash: string): Promise<boolean>;
}

export const PASSWORD_HASHER = Symbol('PasswordHasher');
