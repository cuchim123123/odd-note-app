import { Module } from '@nestjs/common';
import { AuthConfigModule, JwtConfigModule } from '../config';
import { PrismaModule } from '../prisma/prisma.module';
import { NotesController } from './notes.controller';
import { NotesService } from './notes.service';

@Module({
  imports: [PrismaModule, JwtConfigModule, AuthConfigModule],
  controllers: [NotesController],
  providers: [NotesService],
})
export class NotesModule {}
