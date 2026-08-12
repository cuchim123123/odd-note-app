import { type DynamicModule, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigService } from '@nestjs/config';
import type { EnvConfig } from '@config/env.validation';

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
