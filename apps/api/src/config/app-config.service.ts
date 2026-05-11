import { Inject, Injectable } from '@nestjs/common';
import type { EnvConfig } from './env.validation';

/**
 * AppConfigService exposes application-level configuration.
 * Currently owns APP_URL; can be extended for other app-level settings.
 */
@Injectable()
export class AppConfigService {
  constructor(@Inject('ENV_CONFIG') private readonly env: EnvConfig) {}

  getAppUrl(): string {
    return this.env.APP_URL;
  }
}
