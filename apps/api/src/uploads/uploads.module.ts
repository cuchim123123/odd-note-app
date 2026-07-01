import { Module } from '@nestjs/common';
import type { OnModuleInit } from '@nestjs/common';
import { UploadsController } from './uploads.controller';
import { UploadsService } from './uploads.service';
import { JwtConfigModule } from '../config/jwt-config.module';

@Module({
  imports: [JwtConfigModule],
  controllers: [UploadsController],
  providers: [UploadsService],
  exports: [UploadsService],
})
export class UploadsModule implements OnModuleInit {
  constructor(private readonly uploadsService: UploadsService) {}

  async onModuleInit(): Promise<void> {
    await this.uploadsService.ensureBucketExists();
  }
}
