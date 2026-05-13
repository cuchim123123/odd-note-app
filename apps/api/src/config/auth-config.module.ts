import { Module } from '@nestjs/common';
import { ConfigModule } from './config.module';
import { AuthConfigService } from './auth-config.service';

@Module({
  imports: [ConfigModule],
  providers: [AuthConfigService],
  exports: [AuthConfigService],
})
export class AuthConfigModule {}