import { Inject, Injectable } from '@nestjs/common';
import type { EnvConfig } from '../config/config.module';

@Injectable()
export class AuthUrlService {
  constructor(@Inject('ENV_CONFIG') private readonly env: EnvConfig) {}

  buildVerificationEmailUrl(token: string): string {
    const baseUrl = this.env.APP_URL.replace(/\/$/, '');
    return `${baseUrl}/auth/verify-email/${token}`;
  }
}
