import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { GenerateUploadUrlHttpController } from '@modules/uploads/presentation/http/commands/generate-upload-url/generate-upload-url.http.controller';
import { GenerateUploadUrlHandler } from '@modules/uploads/application/commands/generate-upload-url/generate-upload-url.handler';
import { JwtConfigModule } from '@config/jwt-config.module';
import { ConfigModule } from '@config/config.module';
import { STORAGE_PORT } from '@modules/uploads/application/ports/storage.port';
import { S3StorageAdapter } from '@modules/uploads/infrastructure/storage/s3-storage.adapter';

@Module({
  imports: [CqrsModule, JwtConfigModule, ConfigModule],
  controllers: [GenerateUploadUrlHttpController],
  providers: [
    GenerateUploadUrlHandler,
    { provide: STORAGE_PORT, useClass: S3StorageAdapter },
  ],
  exports: [],
})
export class UploadsModule {}
