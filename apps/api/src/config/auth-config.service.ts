import { Inject, Injectable } from '@nestjs/common';
import type { EnvConfig } from './config.module';

@Injectable()
export class AuthConfigService {
  constructor(@Inject('ENV_CONFIG') private readonly env: EnvConfig) {}

  getPasswordSaltRounds(): number {
    return this.env.PASSWORD_SALT_ROUNDS;
  }

  getEmailVerificationTokenExpiryMs(): number {
    return this.parseDurationToMs(this.env.EMAIL_VERIFICATION_TOKEN_EXPIRES_IN);
  }

  private parseDurationToMs(duration: string): number {
    const match = duration.match(/^(\d+)([dhms])$/);
    if (!match) {
      throw new Error(`Invalid duration format: ${duration}`);
    }

    const value = Number(match[1]);
    const unit = match[2];

    switch (unit) {
      case 'd':
        return value * 24 * 60 * 60 * 1000;
      case 'h':
        return value * 60 * 60 * 1000;
      case 'm':
        return value * 60 * 1000;
      case 's':
        return value * 1000;
      default:
        throw new Error(`Unsupported duration unit in: ${duration}`);
    }
  }
}