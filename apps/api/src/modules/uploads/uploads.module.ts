import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { UploadFileHttpController } from '@modules/uploads/presentation/http/commands/upload-file/upload-file.http.controller';
import { UploadFileHandler } from '@modules/uploads/application/commands/upload-file/upload-file.handler';
import { JwtConfigModule } from '@config/jwt-config.module';
import { ConfigModule } from '@config/config.module';
import { STORAGE_PORT } from '@modules/uploads/application/ports/storage.port';
import { S3StorageAdapter } from '@modules/uploads/infrastructure/storage/s3-storage.adapter';

@Module({
  imports: [CqrsModule, JwtConfigModule, ConfigModule],
  controllers: [UploadFileHttpController],
  providers: [
    UploadFileHandler,
    { provide: STORAGE_PORT, useClass: S3StorageAdapter },
  ],
  exports: [],
})
export class UploadsModule {}
