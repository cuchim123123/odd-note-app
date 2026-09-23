import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { AuthConfigModule, JwtConfigModule } from '@config';
import { ConfigModule } from '@config/config.module';
import { PrismaModule } from '@shared/infrastructure/prisma/prisma.module';
import { RedisModule } from '@shared/infrastructure/redis/redis.module';
import { MailerService } from '@shared/infrastructure/messaging/mailer/mailer.service';
import { NotesCrdtService } from '@modules/notes/infrastructure/crdt/notes-crdt.service';
import { NoteMailerAdapter } from '@modules/notes/infrastructure/messaging/note-mailer.adapter';
import { BillingModule } from '@modules/billing/billing.module';

// ─── Application Command Handlers ───────────────────────────────────────────
import { CreateNoteHandler } from '@modules/notes/application/commands/create-note/create-note.handler';
import { UpdateNoteMetadataHandler } from '@modules/notes/application/commands/update-note-metadata/update-note-metadata.handler';
import { DeleteNoteHandler } from '@modules/notes/application/commands/delete-note/delete-note.handler';
import { ShareNoteHandler } from '@modules/notes/application/commands/share-note/share-note.handler';
import { UpdateShareHandler } from '@modules/notes/application/commands/update-share/update-share.handler';
import { RevokeShareHandler } from '@modules/notes/application/commands/revoke-share/revoke-share.handler';
import { SetPasswordHandler } from '@modules/notes/application/commands/set-password/set-password.handler';
import { RemovePasswordHandler } from '@modules/notes/application/commands/remove-password/remove-password.handler';

import { RenameLabelHandler } from '@modules/notes/application/commands/rename-label/rename-label.handler';
import { DeleteLabelHandler } from '@modules/notes/application/commands/delete-label/delete-label.handler';
import { RestoreRevisionHandler } from '@modules/notes/application/commands/restore-revision/restore-revision.handler';


import { UpdateNoteAITagsHandler } from '@modules/notes/application/commands/update-note-ai-tags/update-note-ai-tags.handler';

// ─── Application Query Handlers ──────────────────────────────────────────────
import { ListNotesQueryHandler } from '@modules/notes/application/queries/list-notes/list-notes.query-handler';
import { ListSharedWithMeQueryHandler } from '@modules/notes/application/queries/list-shared-with-me/list-shared-with-me.query-handler';
import { GetNoteByIdQueryHandler } from '@modules/notes/application/queries/get-note-by-id/get-note-by-id.query-handler';
import { ListSharesQueryHandler } from '@modules/notes/application/queries/list-shares/list-shares.query-handler';
import { GetProtectionStatusQueryHandler } from '@modules/notes/application/queries/get-protection-status/get-protection-status.query-handler';

import { GetNoteHistoryQueryHandler } from '@modules/notes/application/queries/get-note-history/get-note-history.query-handler';
import { SearchNotesQueryHandler } from '@modules/notes/application/queries/search-notes/search-notes.query-handler';

// ─── Presentation (HTTP Controllers) ────────────────────────────────────────
import { CreateNoteHttpController } from '@modules/notes/presentation/http/commands/create-note/create-note.http.controller';
import { UpdateNoteMetadataHttpController } from '@modules/notes/presentation/http/commands/update-note-metadata/update-note-metadata.http.controller';
import { DeleteNoteHttpController } from '@modules/notes/presentation/http/commands/delete-note/delete-note.http.controller';
import { ShareNoteHttpController } from '@modules/notes/presentation/http/commands/share-note/share-note.http.controller';
import { UpdateShareHttpController } from '@modules/notes/presentation/http/commands/update-share/update-share.http.controller';
import { RevokeShareHttpController } from '@modules/notes/presentation/http/commands/revoke-share/revoke-share.http.controller';
import { SetPasswordHttpController } from '@modules/notes/presentation/http/commands/set-password/set-password.http.controller';
import { RemovePasswordHttpController } from '@modules/notes/presentation/http/commands/remove-password/remove-password.http.controller';

import { RenameLabelHttpController } from '@modules/notes/presentation/http/commands/rename-label/rename-label.http.controller';
import { DeleteLabelHttpController } from '@modules/notes/presentation/http/commands/delete-label/delete-label.http.controller';
import { RestoreRevisionHttpController } from '@modules/notes/presentation/http/commands/restore-revision/restore-revision.http.controller';
import { ListNotesHttpController } from '@modules/notes/presentation/http/queries/list-notes/list-notes.http.controller';
import { ListSharedWithMeHttpController } from '@modules/notes/presentation/http/queries/list-shared-with-me/list-shared-with-me.http.controller';
import { GetNoteByIdHttpController } from '@modules/notes/presentation/http/queries/get-note-by-id/get-note-by-id.http.controller';
import { ListSharesHttpController } from '@modules/notes/presentation/http/queries/list-shares/list-shares.http.controller';
import { GetProtectionStatusHttpController } from '@modules/notes/presentation/http/queries/get-protection-status/get-protection-status.http.controller';

import { GetNoteHistoryHttpController } from '@modules/notes/presentation/http/queries/get-note-history/get-note-history.http.controller';
import { SearchNotesHttpController } from '@modules/notes/presentation/http/queries/search-notes/search-notes.http.controller';

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
import { USER_NOTE_PREFERENCE_STORE } from '@modules/notes/application/ports/stores/user-note-preference.store.port';
import { PrismaUserNotePreferenceStore } from '@modules/notes/infrastructure/persistence/stores/prisma-user-note-preference.store';
import { NOTE_REVISION_STORE } from '@modules/notes/application/ports/stores/note-revision.store.port';
import { PrismaNoteRevisionStore } from '@modules/notes/infrastructure/persistence/stores/prisma-note-revision.store';
import { USER_READ_PORT } from '@modules/notes/application/ports/dao/user-read.port';
import { PrismaUserReadAdapter } from '@modules/notes/infrastructure/persistence/dao/prisma-user-read.adapter';
import { NOTE_MAIL_SENDER } from '@modules/notes/application/ports/messaging/note-mail-sender.port';
import { NOTE_QUERY_DAO } from '@modules/notes/application/ports/dao/note-query.dao.port';
import { NOTE_REVISION_QUERY_DAO } from '@modules/notes/application/ports/dao/note-revision-query.dao.port';
import { DOCUMENT_UPDATE_STORE } from '@modules/notes/application/ports/stores/document-update.store.port';
import { PrismaDocumentUpdateStore } from '@modules/notes/infrastructure/persistence/stores/prisma-document-update.store';
import { SNAPSHOT_METADATA_REPOSITORY } from '@modules/notes/application/ports/repositories/snapshot-metadata.repository.port';
import { PrismaSnapshotMetadataRepository } from '@modules/notes/infrastructure/persistence/repositories/prisma-snapshot-metadata.repository';
import { SNAPSHOT_STORAGE_PORT } from '@modules/notes/application/ports/external/snapshot-storage.port';
import { S3SnapshotStorageAdapter } from '@modules/notes/infrastructure/storage/s3-snapshot-storage.adapter';
import { ReplayCoordinator } from '@modules/notes/application/services/replay.coordinator';
import { DOCUMENT_ENGINE_PORT } from '@modules/notes/application/ports/external/document-engine.port';
import { YjsDocumentEngineAdapter } from '@modules/notes/infrastructure/crdt/yjs-document-engine.adapter';
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
import { NoteProjectionConsumer } from '@modules/notes/infrastructure/projection/consumers/note-projection.consumer';
import { NoteShareProjectionConsumer } from '@modules/notes/infrastructure/projection/consumers/note-share-projection.consumer';
import { NoteRevisionProjectionConsumer } from '@modules/notes/infrastructure/projection/consumers/note-revision-projection.consumer';
import { NotePreferenceProjectionConsumer } from '@modules/notes/infrastructure/projection/consumers/note-preference-projection.consumer';
import { SearchModule } from '@shared/infrastructure/search/search.module';
import { NOTE_SEARCH_INDEX_PORT } from '@modules/notes/application/ports/external/note-search-index.port';
import { NOTE_SEARCH_DAO } from '@modules/notes/application/ports/dao/note-search.dao.port';
import { OpenSearchNoteIndexAdapter } from '@modules/notes/infrastructure/search/opensearch-note-index.adapter';
import { OpenSearchNoteSearchDao } from '@modules/notes/infrastructure/search/opensearch-note-search.dao';
import { NoteSearchIndexConsumer } from '@modules/notes/infrastructure/search/note-search-index.consumer';
import { NoteIndexRebuildService } from '@modules/notes/infrastructure/search/note-index-rebuild.service';
import { NoteBodyIndexInternalHandler } from '@modules/notes/infrastructure/search/note-body-index.internal-handler';
import { GenerateNoteEmbeddingInternalHandler } from '@modules/notes/application/workers/generate-note-embedding.internal-handler';
import { GenerateNoteAITagsInternalHandler } from '@modules/notes/application/workers/generate-note-ai-tags.internal-handler';
import { EMBEDDING_PROVIDER_PORT } from '@modules/notes/application/ports/external/embedding-provider.port';
import { OpenAIEmbeddingAdapter } from '@modules/notes/infrastructure/ai/openai-embedding.adapter';
import { AI_TAGGING_PROVIDER_PORT } from '@modules/notes/application/ports/external/ai-tagging-provider.port';
import { OpenAITaggingAdapter } from '@modules/notes/infrastructure/ai/openai-tagging.adapter';

@Module({
  imports: [
    CqrsModule, PrismaModule, JwtConfigModule, AuthConfigModule, ConfigModule, RedisModule, IdempotencyModule,
    SearchModule,
    MongooseModule.forFeature([
      { name: NoteProjection.name, schema: NoteProjectionSchema },
      { name: NoteRevisionProjection.name, schema: NoteRevisionProjectionSchema },
    ]),
    BillingModule,
  ],
  controllers: [
    // ── Presentation: Commands ────────────────────────────────────────────
    CreateNoteHttpController,
    UpdateNoteMetadataHttpController,
    DeleteNoteHttpController,
    ShareNoteHttpController,
    UpdateShareHttpController,
    RevokeShareHttpController,
    SetPasswordHttpController,
    RemovePasswordHttpController,

    RenameLabelHttpController,
    DeleteLabelHttpController,
    RestoreRevisionHttpController,
    // ── Presentation: Queries ─────────────────────────────────────────────
    // IMPORTANT: Registration order dictates route evaluation.
    // Specific routes MUST precede wildcard routes (:noteId)
    SearchNotesHttpController,
    ListNotesHttpController,
    ListSharedWithMeHttpController,
    GetNoteByIdHttpController,
    ListSharesHttpController,
    GetProtectionStatusHttpController,
    GetNoteHistoryHttpController,

    // ── Projection Consumers (Kafka) ──────────────────────────────────────
    NoteProjectionConsumer,
    NoteShareProjectionConsumer,
    NoteRevisionProjectionConsumer,
    NotePreferenceProjectionConsumer,
    // ── Search Index Consumer (Kafka) ─────────────────────────────────────
    NoteSearchIndexConsumer,
  ],
  providers: [
    // ── Infrastructure Services ───────────────────────────────────────────
    NotesCrdtService,
    MailerService,
    NoteMailerAdapter,
    // ── Application: Command Handlers ─────────────────────────────────────
    CreateNoteHandler,
    UpdateNoteMetadataHandler,
    DeleteNoteHandler,
    ShareNoteHandler,
    UpdateShareHandler,
    RevokeShareHandler,
    SetPasswordHandler,
    RemovePasswordHandler,

    RenameLabelHandler,
    DeleteLabelHandler,
    RestoreRevisionHandler,

    UpdateNoteAITagsHandler,
    ReplayCoordinator,
    SnapshotThresholdMonitor,
    CreateSnapshotInternalCommandHandler,
    // ── Application: Query Handlers ───────────────────────────────────────
    SearchNotesQueryHandler,
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
    { provide: USER_NOTE_PREFERENCE_STORE, useClass: PrismaUserNotePreferenceStore },
    { provide: NOTE_REVISION_STORE, useClass: PrismaNoteRevisionStore },
    { provide: USER_READ_PORT, useClass: PrismaUserReadAdapter },
    { provide: NOTE_MAIL_SENDER, useClass: NoteMailerAdapter },
    { provide: NOTE_QUERY_DAO, useClass: MongoNoteQueryDao },
    { provide: NOTE_REVISION_QUERY_DAO, useClass: MongoNoteRevisionQueryDao },
    { provide: DOCUMENT_UPDATE_STORE, useClass: PrismaDocumentUpdateStore },
    { provide: SNAPSHOT_METADATA_REPOSITORY, useClass: PrismaSnapshotMetadataRepository },
    { provide: SNAPSHOT_STORAGE_PORT, useClass: S3SnapshotStorageAdapter },
    { provide: DOCUMENT_ENGINE_PORT, useClass: YjsDocumentEngineAdapter },
    { provide: NOTE_ACCESS_PORT, useClass: PrismaNoteAccessAdapter },
    { provide: NOTE_SEARCH_INDEX_PORT, useClass: OpenSearchNoteIndexAdapter },
    { provide: NOTE_SEARCH_DAO, useClass: OpenSearchNoteSearchDao },
    NoteIndexRebuildService,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    { provide: INTERNAL_COMMAND_HANDLERS, useClass: CreateSnapshotInternalCommandHandler, multi: true } as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    { provide: INTERNAL_COMMAND_HANDLERS, useClass: NoteBodyIndexInternalHandler, multi: true } as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    { provide: INTERNAL_COMMAND_HANDLERS, useClass: GenerateNoteEmbeddingInternalHandler, multi: true } as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    { provide: INTERNAL_COMMAND_HANDLERS, useClass: GenerateNoteAITagsInternalHandler, multi: true } as any,
    { provide: EMBEDDING_PROVIDER_PORT, useClass: OpenAIEmbeddingAdapter },
    { provide: AI_TAGGING_PROVIDER_PORT, useClass: OpenAITaggingAdapter },
  ],
  exports: [
    // NOTE_PROTECTION_PORT exported so CollaborationModule's PrismaNoteAccessAdapter can inject it
    NOTE_PROTECTION_PORT,
  ],
})
export class NotesModule {}
