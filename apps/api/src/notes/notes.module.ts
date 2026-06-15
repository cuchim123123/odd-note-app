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
import { UpdateNoteHttpController } from './commands/update-note/update-note.http.controller';
import { UpdateNoteHandler } from './commands/update-note/update-note.handler';
import { DeleteNoteHttpController } from './commands/delete-note/delete-note.http.controller';
import { DeleteNoteHandler } from './commands/delete-note/delete-note.handler';
import { ShareNoteHttpController } from './commands/share-note/share-note.http.controller';
import { ShareNoteHandler } from './commands/share-note/share-note.handler';
import { UpdateShareHttpController } from './commands/update-share/update-share.http.controller';
import { UpdateShareHandler } from './commands/update-share/update-share.handler';
import { RevokeShareHttpController } from './commands/revoke-share/revoke-share.http.controller';
import { RevokeShareHandler } from './commands/revoke-share/revoke-share.handler';
import { NOTE_REPOSITORY } from './application/ports/note.repository.port';
import { PrismaNoteRepository } from './infrastructure/persistence/prisma-note.repository';
import { DRAFT_CACHE_PORT } from './application/ports/draft-cache.port';
import { RedisDraftCacheAdapter } from './infrastructure/cache/redis-draft-cache.adapter';
import { DOCUMENT_SYNC_PORT } from './application/ports/document-sync.port';
import { RedisDocumentSyncAdapter } from './infrastructure/cache/redis-document-sync.adapter';

@Module({
  imports: [PrismaModule, JwtConfigModule, AuthConfigModule, ConfigModule, RedisModule],
  controllers: [
    NotesController, 
    CreateNoteHttpController,
    UpdateNoteHttpController,
    DeleteNoteHttpController,
    ShareNoteHttpController,
    UpdateShareHttpController,
    RevokeShareHttpController,
  ],
  providers: [
    NotesService, 
    NotesShareService, 
    NotesProtectionService, 
    NotesCrdtService, 
    MailerService,
    CreateNoteHandler,
    UpdateNoteHandler,
    DeleteNoteHandler,
    ShareNoteHandler,
    UpdateShareHandler,
    RevokeShareHandler,
    { provide: NOTE_REPOSITORY, useClass: PrismaNoteRepository },
    { provide: DRAFT_CACHE_PORT, useClass: RedisDraftCacheAdapter },
    { provide: DOCUMENT_SYNC_PORT, useClass: RedisDocumentSyncAdapter },
  ],
  exports: [NotesProtectionService, NotesService],
})
export class NotesModule {}
