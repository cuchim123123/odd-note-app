import { Global, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigService } from '@nestjs/config';
import type { EnvConfig } from '@config/env.validation';

/**
 * Global Mongoose module — wired once in AppModule, available everywhere.
 *
 * The module registers MongooseModule only when MONGO_URI is set.
 * This allows the app to boot cleanly without MongoDB when
 * PROJECTION_STORE=postgres (the default).
 */
@Global()
@Module({
  imports: [
    MongooseModule.forRootAsync({
      useFactory: (config: ConfigService<EnvConfig, true>) => {
        const uri = config.get('MONGO_URI', { infer: true });
        return {
          uri: uri ?? 'mongodb://localhost:27017', // placeholder — connection is lazy
          dbName: config.get('MONGO_DB_NAME', { infer: true }),
          // Only attempt connection when URI is explicitly configured
          ...(uri ? {} : { serverSelectionTimeoutMS: 0 }),
        };
      },
      inject: [ConfigService],
    }),
  ],
  exports: [MongooseModule],
})
export class MongoModule {}
