import { Module } from '@nestjs/common';
import { ConfigModule } from '@config/config.module';
import { AuthConfigService } from '@config/auth-config.service';

@Module({
  imports: [ConfigModule],
  providers: [AuthConfigService],
  exports: [AuthConfigService],
})
export class AuthConfigModule {}