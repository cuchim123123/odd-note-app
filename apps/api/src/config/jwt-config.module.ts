import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { JwtConfigService } from './jwt-config.service';

@Module({
  imports: [JwtModule],
  providers: [JwtConfigService],
  exports: [JwtModule, JwtConfigService],
})
export class JwtConfigModule {}
