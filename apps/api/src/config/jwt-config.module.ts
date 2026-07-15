import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule } from '@config/config.module';
import { JwtConfigService } from '@config/jwt-config.service';

@Module({
  imports: [ConfigModule, JwtModule],
  providers: [JwtConfigService],
  exports: [JwtModule, JwtConfigService],
})
export class JwtConfigModule {}
