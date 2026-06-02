import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { AuthConfigService } from '../../../config';
import type { PasswordHasher } from '../../application/ports/password-hasher.port';

@Injectable()
export class BcryptPasswordHasher implements PasswordHasher {
  private readonly saltRounds: number;

  constructor(private readonly authConfig: AuthConfigService) {
    this.saltRounds = this.authConfig.getPasswordSaltRounds();
  }

  async hash(plaintext: string): Promise<string> {
    return bcrypt.hash(plaintext, this.saltRounds);
  }

  async compare(plaintext: string, hash: string): Promise<boolean> {
    return bcrypt.compare(plaintext, hash);
  }
}
