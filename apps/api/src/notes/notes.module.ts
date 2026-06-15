import { Module } from '@nestjs/common';
import { AuthConfigModule, JwtConfigModule } from '../config';
import { ConfigModule } from '../config/config.module';
import { PrismaModule } from '../prisma/prisma.module';
import { RedisModule } from '../redis/redis.module';
import { MailerService } from '../common/mailer/mailer.service';
import { NotesController } from './notes.controller';
import { NotesService } from './notes.service';
import { NotesShareService } from './notes-share.service';
import { NotesProtectionService } from './notes-protection.service';
import { NotesCrdtService } from './notes-crdt.service';

import { CreateNoteHttpController } from './commands/create-note/create-note.http.controller';
import { CreateNoteHandler } from './commands/create-note/create-note.handler';
import { NOTE_REPOSITORY } from './application/ports/note.repository.port';
import { PrismaNoteRepository } from './infrastructure/persistence/prisma-note.repository';
import { DRAFT_CACHE_PORT } from './application/ports/draft-cache.port';
import { RedisDraftCacheAdapter } from './infrastructure/cache/redis-draft-cache.adapter';
import { DOCUMENT_SYNC_PORT } from './application/ports/document-sync.port';
import { RedisDocumentSyncAdapter } from './infrastructure/cache/redis-document-sync.adapter';

@Module({
  imports: [PrismaModule, JwtConfigModule, AuthConfigModule, ConfigModule, RedisModule],
  controllers: [NotesController, CreateNoteHttpController],
  providers: [
    NotesService, 
    NotesShareService, 
    NotesProtectionService, 
    NotesCrdtService, 
    MailerService,
    CreateNoteHandler,
    { provide: NOTE_REPOSITORY, useClass: PrismaNoteRepository },
    { provide: DRAFT_CACHE_PORT, useClass: RedisDraftCacheAdapter },
    { provide: DOCUMENT_SYNC_PORT, useClass: RedisDocumentSyncAdapter },
  ],
  exports: [NotesProtectionService, NotesService],
})
export class NotesModule {}
