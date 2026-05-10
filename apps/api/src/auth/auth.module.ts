import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AuthConfigModule } from '../config/auth-config.module';

@Module({
  imports: [PrismaModule, AuthConfigModule],
  controllers: [AuthController],
  providers: [AuthService],
})
export class AuthModule {}
