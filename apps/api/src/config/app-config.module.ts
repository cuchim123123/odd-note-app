import { Module } from '@nestjs/common';
import { ConfigModule } from '@config/config.module';
import { AppConfigService } from '@config/app-config.service';

@Module({
  imports: [ConfigModule],
  providers: [AppConfigService],
  exports: [AppConfigService],
})
export class AppConfigModule {}
