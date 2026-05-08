import { Module } from '@nestjs/common';
import { validateEnv } from './env.validation';
import type { EnvConfig } from './env.validation';

const envConfig = validateEnv(process.env);

@Module({
  providers: [
    {
      provide: 'ENV_CONFIG',
      useValue: envConfig,
    },
  ],
  exports: ['ENV_CONFIG'],
})
export class ConfigModule {}

export type { EnvConfig };
