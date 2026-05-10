import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { Inject, Injectable } from '@nestjs/common';
import type { EnvConfig } from './config.module';

@Injectable()
export class JwtConfigService {
  constructor(@Inject('ENV_CONFIG') private readonly env: EnvConfig) {}

  getAccessTokenConfig() {
    return {
      secret: this.env.JWT_ACCESS_SECRET,
      expiresIn: this.env.JWT_ACCESS_EXPIRES_IN,
    };
  }

  getRefreshTokenConfig() {
    return {
      secret: this.env.JWT_REFRESH_SECRET,
      expiresIn: this.env.JWT_REFRESH_EXPIRES_IN,
    };
  }

  getAccessTokenSignOptions() {
    return {
      secret: this.env.JWT_ACCESS_SECRET,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expiresIn: this.env.JWT_ACCESS_EXPIRES_IN as any,
    };
  }

  getRefreshTokenSignOptions() {
    return {
      secret: this.env.JWT_REFRESH_SECRET,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expiresIn: this.env.JWT_REFRESH_EXPIRES_IN as any,
    };
  }

  getRefreshTokenExpiryMs(): number {
    const expiresIn = this.env.JWT_REFRESH_EXPIRES_IN;
    const match = expiresIn.match(/(\d+)([dhms])/);
    if (!match) return 7 * 24 * 60 * 60 * 1000; // default 7 days

    const [, value, unit] = match;
    const n = Number(value);
    switch (unit) {
      case 'd':
        return n * 24 * 60 * 60 * 1000;
      case 'h':
        return n * 60 * 60 * 1000;
      case 'm':
        return n * 60 * 1000;
      case 's':
        return n * 1000;
      default:
        return 7 * 24 * 60 * 60 * 1000;
    }
  }
}

@Module({
  imports: [
    JwtModule.registerAsync({
      useFactory: (jwtConfig: JwtConfigService) => jwtConfig.getAccessTokenConfig(),
      inject: [JwtConfigService],
    }),
  ],
  providers: [JwtConfigService],
  exports: [JwtModule, JwtConfigService],
})
export class JwtConfigModule {}
