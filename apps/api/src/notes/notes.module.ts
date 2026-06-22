import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { AuthConfigModule, JwtConfigModule } from '../config';
import { ConfigModule } from '../config/config.module';
import { PrismaModule } from '../prisma/prisma.module';
import { RedisModule } from '../redis/redis.module';
import { MailerService } from '../common/mailer/mailer.service';
import { NotesCrdtService } from './notes-crdt.service';

// ─── Commands ──────────────────────────────────────────────────────────────
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
import { SetPasswordHttpController } from './commands/set-password/set-password.http.controller';
import { SetPasswordHandler } from './commands/set-password/set-password.handler';
import { RemovePasswordHttpController } from './commands/remove-password/remove-password.http.controller';
import { RemovePasswordHandler } from './commands/remove-password/remove-password.handler';
import { VerifyPasswordHttpController } from './commands/verify-password/verify-password.http.controller';
import { VerifyPasswordHandler } from './commands/verify-password/verify-password.handler';
import { SaveDraftHttpController } from './commands/save-draft/save-draft.http.controller';
import { SaveDraftHandler } from './commands/save-draft/save-draft.handler';
import { ClearDraftHttpController } from './commands/clear-draft/clear-draft.http.controller';
import { ClearDraftHandler } from './commands/clear-draft/clear-draft.handler';
import { RenameLabelHttpController } from './commands/rename-label/rename-label.http.controller';
import { RenameLabelHandler } from './commands/rename-label/rename-label.handler';
import { DeleteLabelHttpController } from './commands/delete-label/delete-label.http.controller';
import { DeleteLabelHandler } from './commands/delete-label/delete-label.handler';

// ─── Queries ────────────────────────────────────────────────────────────────
import { ListNotesHttpController } from './queries/list-notes/list-notes.http.controller';
import { ListNotesQueryHandler } from './queries/list-notes/list-notes.query-handler';
import { ListSharedWithMeHttpController } from './queries/list-shared-with-me/list-shared-with-me.http.controller';
import { ListSharedWithMeQueryHandler } from './queries/list-shared-with-me/list-shared-with-me.query-handler';
import { GetNoteByIdHttpController } from './queries/get-note-by-id/get-note-by-id.http.controller';
import { GetNoteByIdQueryHandler } from './queries/get-note-by-id/get-note-by-id.query-handler';
import { ListSharesHttpController } from './queries/list-shares/list-shares.http.controller';
import { ListSharesQueryHandler } from './queries/list-shares/list-shares.query-handler';
import { GetProtectionStatusHttpController } from './queries/get-protection-status/get-protection-status.http.controller';
import { GetProtectionStatusQueryHandler } from './queries/get-protection-status/get-protection-status.query-handler';
import { GetDraftHttpController } from './queries/get-draft/get-draft.http.controller';
import { GetDraftQueryHandler } from './queries/get-draft/get-draft.query-handler';

// ─── Ports & Adapters ────────────────────────────────────────────────────────
import { NOTE_REPOSITORY } from './application/ports/note.repository.port';
import { PrismaNoteRepository } from './infrastructure/persistence/prisma-note.repository';
import { DRAFT_CACHE_PORT } from './application/ports/draft-cache.port';
import { RedisDraftCacheAdapter } from './infrastructure/cache/redis-draft-cache.adapter';
import { DOCUMENT_SYNC_PORT } from './application/ports/document-sync.port';
import { RedisDocumentSyncAdapter } from './infrastructure/cache/redis-document-sync.adapter';
import { NOTE_PROTECTION_PORT } from './application/ports/note-protection.port';
import { PrismaNoteProtectionAdapter } from './infrastructure/persistence/prisma-note-protection.adapter';
import { NOTE_OUTBOX_PORT } from './application/ports/note-outbox.port';
import { PrismaOutboxAdapter } from './infrastructure/outbox/prisma-outbox.adapter';
import { NOTE_SHARE_REPOSITORY } from './application/ports/note-share.repository.port';
import { PrismaNoteShareRepository } from './infrastructure/persistence/prisma-note-share.repository';
import { USER_PREFERENCES_REPOSITORY } from './application/ports/user-preferences.repository.port';
import { PrismaUserPreferencesRepository } from './infrastructure/persistence/prisma-user-preferences.repository';
import { USER_READ_PORT } from './application/ports/user-read.port';
import { PrismaUserReadAdapter } from './infrastructure/persistence/prisma-user-read.adapter';

@Module({
  imports: [CqrsModule, PrismaModule, JwtConfigModule, AuthConfigModule, ConfigModule, RedisModule],
  controllers: [
    // Commands
    CreateNoteHttpController,
    UpdateNoteHttpController,
    DeleteNoteHttpController,
    ShareNoteHttpController,
    UpdateShareHttpController,
    RevokeShareHttpController,
    SetPasswordHttpController,
    RemovePasswordHttpController,
    VerifyPasswordHttpController,
    SaveDraftHttpController,
    ClearDraftHttpController,
    RenameLabelHttpController,
    DeleteLabelHttpController,
    // Queries
    // IMPORTANT: Registration order dictates route evaluation.
    // Specific routes (shared-with-me) MUST precede wildcard routes (:noteId)
    ListNotesHttpController,
    ListSharedWithMeHttpController,
    GetNoteByIdHttpController,
    ListSharesHttpController,
    GetProtectionStatusHttpController,
    GetDraftHttpController,
  ],
  providers: [
    // Infrastructure services needed by adapters
    NotesCrdtService,
    MailerService,
    // Command Handlers
    CreateNoteHandler,
    UpdateNoteHandler,
    DeleteNoteHandler,
    ShareNoteHandler,
    UpdateShareHandler,
    RevokeShareHandler,
    SetPasswordHandler,
    RemovePasswordHandler,
    VerifyPasswordHandler,
    SaveDraftHandler,
    ClearDraftHandler,
    RenameLabelHandler,
    DeleteLabelHandler,
    // Query Handlers
    ListNotesQueryHandler,
    ListSharedWithMeQueryHandler,
    GetNoteByIdQueryHandler,
    ListSharesQueryHandler,
    GetProtectionStatusQueryHandler,
    GetDraftQueryHandler,
    // Port → Adapter bindings
    { provide: NOTE_REPOSITORY, useClass: PrismaNoteRepository },
    { provide: DRAFT_CACHE_PORT, useClass: RedisDraftCacheAdapter },
    { provide: DOCUMENT_SYNC_PORT, useClass: RedisDocumentSyncAdapter },
    { provide: NOTE_PROTECTION_PORT, useClass: PrismaNoteProtectionAdapter },
    { provide: NOTE_OUTBOX_PORT, useClass: PrismaOutboxAdapter },
    { provide: NOTE_SHARE_REPOSITORY, useClass: PrismaNoteShareRepository },
    { provide: USER_PREFERENCES_REPOSITORY, useClass: PrismaUserPreferencesRepository },
    { provide: USER_READ_PORT, useClass: PrismaUserReadAdapter },
  ],
  exports: [
    // NOTE_PROTECTION_PORT exported so CollaborationModule's PrismaNoteAccessAdapter can inject it
    NOTE_PROTECTION_PORT,
  ],
})
export class NotesModule {}
