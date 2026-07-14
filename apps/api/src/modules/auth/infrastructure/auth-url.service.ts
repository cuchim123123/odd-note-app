import { Inject, Injectable } from '@nestjs/common';
import type { EnvConfig } from '../../../config/env.validation';

@Injectable()
export class AuthUrlService {
  constructor(@Inject('ENV_CONFIG') private readonly env: EnvConfig) {}

  buildVerificationEmailUrl(token: string): string {
    const baseUrl = this.env.APP_URL.replace(/\/$/, '');
    return `${baseUrl}/verify-email/${token}`;
  }

  buildResetPasswordUrl(token: string): string {
    const baseUrl = this.env.APP_URL.replace(/\/$/, '');
    return `${baseUrl}/reset-password?token=${encodeURIComponent(token)}`;
  }
}
