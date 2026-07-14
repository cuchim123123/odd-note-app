import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { AuthConfigModule, JwtConfigModule } from '../../config';
import { ConfigModule } from '../../config/config.module';
import { PrismaModule } from '../../prisma/prisma.module';
import { RedisModule } from '../../redis/redis.module';
import { MailerService } from '../../common/infrastructure/messaging/mailer/mailer.service';
import { NotesCrdtService } from './infrastructure/crdt/notes-crdt.service';
import { NoteMailerAdapter } from './infrastructure/messaging/note-mailer.adapter';

// ─── Application Command Handlers ───────────────────────────────────────────
import { CreateNoteHandler } from './application/commands/create-note/create-note.handler';
import { UpdateNoteHandler } from './application/commands/update-note/update-note.handler';
import { DeleteNoteHandler } from './application/commands/delete-note/delete-note.handler';
import { ShareNoteHandler } from './application/commands/share-note/share-note.handler';
import { UpdateShareHandler } from './application/commands/update-share/update-share.handler';
import { RevokeShareHandler } from './application/commands/revoke-share/revoke-share.handler';
import { SetPasswordHandler } from './application/commands/set-password/set-password.handler';
import { RemovePasswordHandler } from './application/commands/remove-password/remove-password.handler';
import { VerifyPasswordHandler } from './application/commands/verify-password/verify-password.handler';
import { SaveDraftHandler } from './application/commands/save-draft/save-draft.handler';
import { ClearDraftHandler } from './application/commands/clear-draft/clear-draft.handler';
import { RenameLabelHandler } from './application/commands/rename-label/rename-label.handler';
import { DeleteLabelHandler } from './application/commands/delete-label/delete-label.handler';
import { CreateRevisionHandler } from './application/commands/create-revision/create-revision.handler';
import { RestoreRevisionHandler } from './application/commands/restore-revision/restore-revision.handler';

// ─── Application Domain Event Handlers ──────────────────────────────────────

// ─── Application Query Handlers ──────────────────────────────────────────────
import { ListNotesQueryHandler } from './application/queries/list-notes/list-notes.query-handler';
import { ListSharedWithMeQueryHandler } from './application/queries/list-shared-with-me/list-shared-with-me.query-handler';
import { GetNoteByIdQueryHandler } from './application/queries/get-note-by-id/get-note-by-id.query-handler';
import { ListSharesQueryHandler } from './application/queries/list-shares/list-shares.query-handler';
import { GetProtectionStatusQueryHandler } from './application/queries/get-protection-status/get-protection-status.query-handler';
import { GetDraftQueryHandler } from './application/queries/get-draft/get-draft.query-handler';
import { GetNoteHistoryQueryHandler } from './application/queries/get-note-history/get-note-history.query-handler';

// ─── Presentation (HTTP Controllers) ────────────────────────────────────────
import { CreateNoteHttpController } from './presentation/http/commands/create-note.http.controller';
import { UpdateNoteHttpController } from './presentation/http/commands/update-note.http.controller';
import { DeleteNoteHttpController } from './presentation/http/commands/delete-note.http.controller';
import { ShareNoteHttpController } from './presentation/http/commands/share-note.http.controller';
import { UpdateShareHttpController } from './presentation/http/commands/update-share.http.controller';
import { RevokeShareHttpController } from './presentation/http/commands/revoke-share.http.controller';
import { SetPasswordHttpController } from './presentation/http/commands/set-password.http.controller';
import { RemovePasswordHttpController } from './presentation/http/commands/remove-password.http.controller';
import { VerifyPasswordHttpController } from './presentation/http/commands/verify-password.http.controller';
import { SaveDraftHttpController } from './presentation/http/commands/save-draft.http.controller';
import { ClearDraftHttpController } from './presentation/http/commands/clear-draft.http.controller';
import { RenameLabelHttpController } from './presentation/http/commands/rename-label.http.controller';
import { DeleteLabelHttpController } from './presentation/http/commands/delete-label.http.controller';
import { RestoreRevisionHttpController } from './presentation/http/commands/restore-revision.http.controller';
import { ListNotesHttpController } from './presentation/http/queries/list-notes.http.controller';
import { ListSharedWithMeHttpController } from './presentation/http/queries/list-shared-with-me.http.controller';
import { GetNoteByIdHttpController } from './presentation/http/queries/get-note-by-id.http.controller';
import { ListSharesHttpController } from './presentation/http/queries/list-shares.http.controller';
import { GetProtectionStatusHttpController } from './presentation/http/queries/get-protection-status.http.controller';
import { GetDraftHttpController } from './presentation/http/queries/get-draft.http.controller';
import { GetNoteHistoryHttpController } from './presentation/http/queries/get-note-history.http.controller';

// ─── Ports & Adapters ────────────────────────────────────────────────────────
import { NOTE_UNIT_OF_WORK } from './application/ports/unit-of-work.port';
import { PrismaNoteUnitOfWork } from './infrastructure/persistence/prisma-note-unit-of-work';
import { NOTE_REPOSITORY } from './application/ports/note.repository.port';
import { PrismaNoteRepository } from './infrastructure/persistence/prisma-note.repository';
import { DRAFT_CACHE_PORT } from './application/ports/draft-cache.port';
import { RedisDraftCacheAdapter } from './infrastructure/cache/redis-draft-cache.adapter';
import { DOCUMENT_SYNC_PORT } from './application/ports/document-sync.port';
import { RedisDocumentSyncAdapter } from './infrastructure/cache/redis-document-sync.adapter';
import { NOTE_PROTECTION_PORT } from './application/ports/note-protection.port';
import { PrismaNoteProtectionAdapter } from './infrastructure/persistence/prisma-note-protection.adapter';
import { NOTE_OUTBOX_PORT } from './application/ports/note-outbox.port';
import { NOTE_INTEGRATION_EVENT_MAPPER } from './application/ports/integration-event-mapper.port';
import { DefaultNoteIntegrationEventMapper } from './application/mappers/integration-event.mapper';
import { PrismaOutboxAdapter } from './infrastructure/outbox/prisma-outbox.adapter';
import { NOTE_SHARE_REPOSITORY } from './application/ports/note-share.repository.port';
import { PrismaNoteShareRepository } from './infrastructure/persistence/prisma-note-share.repository';
import { USER_PREFERENCES_REPOSITORY } from './application/ports/user-preferences.repository.port';
import { PrismaUserPreferencesRepository } from './infrastructure/persistence/prisma-user-preferences.repository';
import { USER_READ_PORT } from './application/ports/user-read.port';
import { PrismaUserReadAdapter } from './infrastructure/persistence/prisma-user-read.adapter';
import { NOTE_REVISION_REPOSITORY } from './application/ports/note-revision.repository.port';
import { PrismaNoteRevisionRepository } from './infrastructure/persistence/prisma-note-revision.repository';
import { NOTE_MAIL_SENDER } from './application/ports/note-mail-sender.port';

@Module({
  imports: [CqrsModule, PrismaModule, JwtConfigModule, AuthConfigModule, ConfigModule, RedisModule],
  controllers: [
    // ── Presentation: Commands ────────────────────────────────────────────
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
    RestoreRevisionHttpController,
    // ── Presentation: Queries ─────────────────────────────────────────────
    // IMPORTANT: Registration order dictates route evaluation.
    // Specific routes MUST precede wildcard routes (:noteId)
    ListNotesHttpController,
    ListSharedWithMeHttpController,
    GetNoteByIdHttpController,
    ListSharesHttpController,
    GetProtectionStatusHttpController,
    GetDraftHttpController,
    GetNoteHistoryHttpController,
  ],
  providers: [
    // ── Infrastructure Services ───────────────────────────────────────────
    NotesCrdtService,
    MailerService,
    NoteMailerAdapter,
    // ── Application: Command Handlers ─────────────────────────────────────
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
    CreateRevisionHandler,
    RestoreRevisionHandler,
    // ── Application: Domain Event Handlers ────────────────────────────────
    // ── Application: Query Handlers ───────────────────────────────────────
    ListNotesQueryHandler,
    ListSharedWithMeQueryHandler,
    GetNoteByIdQueryHandler,
    ListSharesQueryHandler,
    GetProtectionStatusQueryHandler,
    GetDraftQueryHandler,
    GetNoteHistoryQueryHandler,
    // ── Port → Adapter Bindings ───────────────────────────────────────────
    { provide: NOTE_UNIT_OF_WORK, useClass: PrismaNoteUnitOfWork },
    { provide: NOTE_REPOSITORY, useClass: PrismaNoteRepository },
    { provide: DRAFT_CACHE_PORT, useClass: RedisDraftCacheAdapter },
    { provide: DOCUMENT_SYNC_PORT, useClass: RedisDocumentSyncAdapter },
    { provide: NOTE_PROTECTION_PORT, useClass: PrismaNoteProtectionAdapter },
    { provide: NOTE_OUTBOX_PORT, useClass: PrismaOutboxAdapter },
    { provide: NOTE_INTEGRATION_EVENT_MAPPER, useClass: DefaultNoteIntegrationEventMapper },
    { provide: NOTE_SHARE_REPOSITORY, useClass: PrismaNoteShareRepository },
    { provide: USER_PREFERENCES_REPOSITORY, useClass: PrismaUserPreferencesRepository },
    { provide: USER_READ_PORT, useClass: PrismaUserReadAdapter },
    { provide: NOTE_REVISION_REPOSITORY, useClass: PrismaNoteRevisionRepository },
    { provide: NOTE_MAIL_SENDER, useClass: NoteMailerAdapter },
  ],
  exports: [
    // NOTE_PROTECTION_PORT exported so CollaborationModule's PrismaNoteAccessAdapter can inject it
    NOTE_PROTECTION_PORT,
  ],
})
export class NotesModule {}
