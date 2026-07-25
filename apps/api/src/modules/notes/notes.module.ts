import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { AuthConfigModule, JwtConfigModule } from '@config';
import { ConfigModule } from '@config/config.module';
import { PrismaModule } from '@shared/infrastructure/prisma/prisma.module';
import { RedisModule } from '@shared/infrastructure/redis/redis.module';
import { MailerService } from '@shared/infrastructure/messaging/mailer/mailer.service';
import { NotesCrdtService } from '@modules/notes/infrastructure/crdt/notes-crdt.service';
import { NoteMailerAdapter } from '@modules/notes/infrastructure/messaging/note-mailer.adapter';

// ─── Application Command Handlers ───────────────────────────────────────────
import { CreateNoteHandler } from '@modules/notes/application/commands/create-note/create-note.handler';
import { UpdateNoteHandler } from '@modules/notes/application/commands/update-note/update-note.handler';
import { DeleteNoteHandler } from '@modules/notes/application/commands/delete-note/delete-note.handler';
import { ShareNoteHandler } from '@modules/notes/application/commands/share-note/share-note.handler';
import { UpdateShareHandler } from '@modules/notes/application/commands/update-share/update-share.handler';
import { RevokeShareHandler } from '@modules/notes/application/commands/revoke-share/revoke-share.handler';
import { SetPasswordHandler } from '@modules/notes/application/commands/set-password/set-password.handler';
import { RemovePasswordHandler } from '@modules/notes/application/commands/remove-password/remove-password.handler';
import { VerifyPasswordHandler } from '@modules/notes/application/commands/verify-password/verify-password.handler';

import { RenameLabelHandler } from '@modules/notes/application/commands/rename-label/rename-label.handler';
import { DeleteLabelHandler } from '@modules/notes/application/commands/delete-label/delete-label.handler';
import { RestoreRevisionHandler } from '@modules/notes/application/commands/restore-revision/restore-revision.handler';

import { CreateRevisionHandler } from '@modules/notes/application/commands/create-revision/create-revision.handler';

// ─── Application Query Handlers ──────────────────────────────────────────────
import { ListNotesQueryHandler } from '@modules/notes/application/queries/list-notes/list-notes.query-handler';
import { ListSharedWithMeQueryHandler } from '@modules/notes/application/queries/list-shared-with-me/list-shared-with-me.query-handler';
import { GetNoteByIdQueryHandler } from '@modules/notes/application/queries/get-note-by-id/get-note-by-id.query-handler';
import { ListSharesQueryHandler } from '@modules/notes/application/queries/list-shares/list-shares.query-handler';
import { GetProtectionStatusQueryHandler } from '@modules/notes/application/queries/get-protection-status/get-protection-status.query-handler';

import { GetNoteHistoryQueryHandler } from '@modules/notes/application/queries/get-note-history/get-note-history.query-handler';

// ─── Presentation (HTTP Controllers) ────────────────────────────────────────
import { CreateNoteHttpController } from '@modules/notes/presentation/http/commands/create-note/create-note.http.controller';
import { UpdateNoteHttpController } from '@modules/notes/presentation/http/commands/update-note/update-note.http.controller';
import { DeleteNoteHttpController } from '@modules/notes/presentation/http/commands/delete-note/delete-note.http.controller';
import { ShareNoteHttpController } from '@modules/notes/presentation/http/commands/share-note/share-note.http.controller';
import { UpdateShareHttpController } from '@modules/notes/presentation/http/commands/update-share/update-share.http.controller';
import { RevokeShareHttpController } from '@modules/notes/presentation/http/commands/revoke-share/revoke-share.http.controller';
import { SetPasswordHttpController } from '@modules/notes/presentation/http/commands/set-password/set-password.http.controller';
import { RemovePasswordHttpController } from '@modules/notes/presentation/http/commands/remove-password/remove-password.http.controller';
import { VerifyPasswordHttpController } from '@modules/notes/presentation/http/commands/verify-password/verify-password.http.controller';

import { RenameLabelHttpController } from '@modules/notes/presentation/http/commands/rename-label/rename-label.http.controller';
import { DeleteLabelHttpController } from '@modules/notes/presentation/http/commands/delete-label/delete-label.http.controller';
import { RestoreRevisionHttpController } from '@modules/notes/presentation/http/commands/restore-revision/restore-revision.http.controller';
import { ListNotesHttpController } from '@modules/notes/presentation/http/queries/list-notes/list-notes.http.controller';
import { ListSharedWithMeHttpController } from '@modules/notes/presentation/http/queries/list-shared-with-me/list-shared-with-me.http.controller';
import { GetNoteByIdHttpController } from '@modules/notes/presentation/http/queries/get-note-by-id/get-note-by-id.http.controller';
import { ListSharesHttpController } from '@modules/notes/presentation/http/queries/list-shares/list-shares.http.controller';
import { GetProtectionStatusHttpController } from '@modules/notes/presentation/http/queries/get-protection-status/get-protection-status.http.controller';

import { GetNoteHistoryHttpController } from '@modules/notes/presentation/http/queries/get-note-history/get-note-history.http.controller';

// ─── Ports & Adapters ────────────────────────────────────────────────────────
import { NOTE_UNIT_OF_WORK } from '@modules/notes/application/ports/transactions/unit-of-work.port';
import { PrismaNoteUnitOfWork } from '@modules/notes/infrastructure/persistence/transactions/prisma-note-unit-of-work';
import { NOTE_REPOSITORY } from '@modules/notes/application/ports/repositories/note.repository.port';
import { PrismaNoteRepository } from '@modules/notes/infrastructure/persistence/repositories/prisma-note.repository';

import { DOCUMENT_SYNC_PORT } from '@modules/notes/application/ports/external/document-sync.port';
import { RedisDocumentSyncAdapter } from '@modules/notes/infrastructure/cache/redis-document-sync.adapter';
import { NOTE_PROTECTION_PORT } from '@modules/notes/application/ports/external/note-protection.port';
import { PrismaNoteProtectionAdapter } from '@modules/notes/infrastructure/persistence/security/prisma-note-protection.adapter';
import { NOTE_OUTBOX_PORT } from '@modules/notes/application/ports/messaging/note-outbox.port';
import { NOTE_INTEGRATION_EVENT_MAPPER } from '@modules/notes/application/ports/messaging/integration-event-mapper.port';
import { DefaultNoteIntegrationEventMapper } from '@modules/notes/application/mappers/integration-event.mapper';
import { PrismaOutboxAdapter } from '@modules/notes/infrastructure/outbox/prisma-outbox.adapter';
import { NOTE_SHARE_REPOSITORY } from '@modules/notes/application/ports/repositories/note-share.repository.port';
import { PrismaNoteShareRepository } from '@modules/notes/infrastructure/persistence/repositories/prisma-note-share.repository';
import { USER_PREFERENCES_REPOSITORY } from '@modules/notes/application/ports/repositories/user-preferences.repository.port';
import { PrismaUserPreferencesRepository } from '@modules/notes/infrastructure/persistence/repositories/prisma-user-preferences.repository';
import { USER_READ_PORT } from '@modules/notes/application/ports/dao/user-read.port';
import { PrismaUserReadAdapter } from '@modules/notes/infrastructure/persistence/dao/prisma-user-read.adapter';
import { NOTE_REVISION_REPOSITORY } from '@modules/notes/application/ports/repositories/note-revision.repository.port';
import { PrismaNoteRevisionRepository } from '@modules/notes/infrastructure/persistence/repositories/prisma-note-revision.repository';
import { NOTE_MAIL_SENDER } from '@modules/notes/application/ports/messaging/note-mail-sender.port';
import { NOTE_QUERY_DAO } from '@modules/notes/application/ports/dao/note-query.dao.port';
import { PrismaNoteQueryDao } from '@modules/notes/infrastructure/persistence/dao/prisma-note-query.dao';
import { NOTE_REVISION_QUERY_DAO } from '@modules/notes/application/ports/dao/note-revision-query.dao.port';
import { PrismaNoteRevisionQueryDao } from '@modules/notes/infrastructure/persistence/dao/prisma-note-revision-query.dao';
import { NOTE_UPDATE_REPOSITORY } from '@modules/notes/application/ports/repositories/note-update.repository.port';
import { PrismaNoteUpdateRepository } from '@modules/notes/infrastructure/persistence/repositories/prisma-note-update.repository';
import { SNAPSHOT_METADATA_REPOSITORY } from '@modules/notes/application/ports/repositories/snapshot-metadata.repository.port';
import { PrismaSnapshotMetadataRepository } from '@modules/notes/infrastructure/persistence/repositories/prisma-snapshot-metadata.repository';
import { SNAPSHOT_STORAGE_PORT } from '@modules/notes/application/ports/external/snapshot-storage.port';
import { S3SnapshotStorageAdapter } from '@modules/notes/infrastructure/storage/s3-snapshot-storage.adapter';
import { ReplayCoordinator } from '@modules/notes/application/services/replay.coordinator';
import { SnapshotThresholdMonitor } from '@modules/notes/application/workers/snapshot.worker';
import { CreateSnapshotInternalCommandHandler } from '@modules/notes/application/workers/create-snapshot.internal-handler';
import { INTERNAL_COMMAND_HANDLERS } from '@shared/infrastructure/outbox/internal-command-handler.port';
import { IdempotencyModule } from '@shared/infrastructure/idempotency/idempotency.module';
import { NOTE_ACCESS_PORT } from '@modules/notes/application/ports/security/note-access.port';
import { PrismaNoteAccessAdapter } from '@modules/notes/infrastructure/persistence/security/prisma-note-access.adapter';
import { MongoNoteQueryDao } from '@modules/notes/infrastructure/projection/dao/mongo-note-query.dao';
import { MongoNoteRevisionQueryDao } from '@modules/notes/infrastructure/projection/dao/mongo-note-revision-query.dao';
import { NoteProjection, NoteProjectionSchema } from '@modules/notes/infrastructure/projection/schemas/note-projection.schema';
import { NoteRevisionProjection, NoteRevisionProjectionSchema } from '@modules/notes/infrastructure/projection/schemas/note-revision-projection.schema';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigService } from '@nestjs/config';
import type { EnvConfig } from '@config/env.validation';
import { NoteProjectionConsumer } from '@modules/notes/infrastructure/projection/consumers/note-projection.consumer';
import { NoteShareProjectionConsumer } from '@modules/notes/infrastructure/projection/consumers/note-share-projection.consumer';
import { NoteRevisionProjectionConsumer } from '@modules/notes/infrastructure/projection/consumers/note-revision-projection.consumer';

@Module({
  imports: [
    CqrsModule, PrismaModule, JwtConfigModule, AuthConfigModule, ConfigModule, RedisModule, IdempotencyModule,
    MongooseModule.forFeature([
      { name: NoteProjection.name, schema: NoteProjectionSchema },
      { name: NoteRevisionProjection.name, schema: NoteRevisionProjectionSchema },
    ]),
  ],
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

    GetNoteHistoryHttpController,
  ],
  providers: [
    // ── Infrastructure Services ───────────────────────────────────────────
    NotesCrdtService,
    MailerService,
    NoteMailerAdapter,
    // ── Projection Consumers (MongoDB write side) ─────────────────────────
    NoteProjectionConsumer,
    NoteShareProjectionConsumer,
    NoteRevisionProjectionConsumer,
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

    RenameLabelHandler,
    DeleteLabelHandler,
    RestoreRevisionHandler,
    CreateRevisionHandler,
    ReplayCoordinator,
    SnapshotThresholdMonitor,
    CreateSnapshotInternalCommandHandler,
    // ── Application: Query Handlers ───────────────────────────────────────
    ListNotesQueryHandler,
    ListSharedWithMeQueryHandler,
    GetNoteByIdQueryHandler,
    ListSharesQueryHandler,
    GetProtectionStatusQueryHandler,

    GetNoteHistoryQueryHandler,
    // ── Port → Adapter Bindings ───────────────────────────────────────────
    { provide: NOTE_UNIT_OF_WORK, useClass: PrismaNoteUnitOfWork },
    { provide: NOTE_REPOSITORY, useClass: PrismaNoteRepository },

    { provide: DOCUMENT_SYNC_PORT, useClass: RedisDocumentSyncAdapter },
    { provide: NOTE_PROTECTION_PORT, useClass: PrismaNoteProtectionAdapter },
    { provide: NOTE_OUTBOX_PORT, useClass: PrismaOutboxAdapter },
    { provide: NOTE_INTEGRATION_EVENT_MAPPER, useClass: DefaultNoteIntegrationEventMapper },
    { provide: NOTE_SHARE_REPOSITORY, useClass: PrismaNoteShareRepository },
    { provide: USER_PREFERENCES_REPOSITORY, useClass: PrismaUserPreferencesRepository },
    { provide: USER_READ_PORT, useClass: PrismaUserReadAdapter },
    { provide: NOTE_REVISION_REPOSITORY, useClass: PrismaNoteRevisionRepository },
    { provide: NOTE_MAIL_SENDER, useClass: NoteMailerAdapter },
    PrismaNoteQueryDao,
    MongoNoteQueryDao,
    PrismaNoteRevisionQueryDao,
    MongoNoteRevisionQueryDao,
    {
      provide: NOTE_QUERY_DAO,
      useFactory: (
        cfg: ConfigService<EnvConfig, true>,
        prisma: PrismaNoteQueryDao,
        mongo: MongoNoteQueryDao,
      ) => (cfg.get('PROJECTION_STORE', { infer: true }) === 'mongo' ? mongo : prisma),
      inject: [ConfigService, PrismaNoteQueryDao, MongoNoteQueryDao],
    },
    {
      provide: NOTE_REVISION_QUERY_DAO,
      useFactory: (
        cfg: ConfigService<EnvConfig, true>,
        prisma: PrismaNoteRevisionQueryDao,
        mongo: MongoNoteRevisionQueryDao,
      ) => (cfg.get('PROJECTION_STORE', { infer: true }) === 'mongo' ? mongo : prisma),
      inject: [ConfigService, PrismaNoteRevisionQueryDao, MongoNoteRevisionQueryDao],
    },
    { provide: NOTE_UPDATE_REPOSITORY, useClass: PrismaNoteUpdateRepository },
    { provide: SNAPSHOT_METADATA_REPOSITORY, useClass: PrismaSnapshotMetadataRepository },
    { provide: SNAPSHOT_STORAGE_PORT, useClass: S3SnapshotStorageAdapter },
    { provide: NOTE_ACCESS_PORT, useClass: PrismaNoteAccessAdapter },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    { provide: INTERNAL_COMMAND_HANDLERS, useClass: CreateSnapshotInternalCommandHandler, multi: true } as any,
  ],
  exports: [
    // NOTE_PROTECTION_PORT exported so CollaborationModule's PrismaNoteAccessAdapter can inject it
    NOTE_PROTECTION_PORT,
  ],
})
export class NotesModule {}
