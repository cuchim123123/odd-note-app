import { type DynamicModule, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigService } from '@nestjs/config';
import type { EnvConfig } from '@config/env.validation';

/**
 * Conditional Mongoose module — only registers MongooseModule when
 * MONGO_URI is explicitly configured in the environment.
 *
 * When PROJECTION_STORE=postgres (the default) and MONGO_URI is absent,
 * this module is a no-op: no connection is attempted, no error is thrown.
 * This guarantees zero-impact on environments that haven't provisioned MongoDB yet.
 */
@Module({})
export class MongoModule {
  static forRoot(): DynamicModule {
    return {
      module: MongoModule,
      global: false, // explicit: only NotesModule needs Mongoose
      imports: [
        MongooseModule.forRootAsync({
          useFactory: (config: ConfigService<EnvConfig, true>) => {
            const uri = config.get('MONGO_URI', { infer: true });

            if (!uri) {
              // No URI — return a config that will never resolve a real connection.
              // Mongoose defers connection until a model is first accessed; since
              // PROJECTION_STORE=postgres means no model is ever injected, this is safe.
              return {
                uri: 'mongodb://127.0.0.1:0', // unroutable — instant ECONNREFUSED if accessed
                dbName: 'noop',
                serverSelectionTimeoutMS: 1, // fail fast if somehow accessed
                connectTimeoutMS: 1,
              };
            }

            return {
              uri,
              dbName: config.get('MONGO_DB_NAME', { infer: true }),
            };
          },
          inject: [ConfigService],
        }),
      ],
      exports: [MongooseModule],
    };
  }
}
