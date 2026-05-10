import { Module } from '@nestjs/common';
import { Inject, Injectable } from '@nestjs/common';
import type { EnvConfig } from './config.module';

@Injectable()
export class AuthConfigService {
  constructor(@Inject('ENV_CONFIG') private readonly env: EnvConfig) {}

  getPasswordSaltRounds(): number {
    return this.env.PASSWORD_SALT_ROUNDS;
  }
}

@Module({
  providers: [AuthConfigService],
  exports: [AuthConfigService],
})
export class AuthConfigModule {}