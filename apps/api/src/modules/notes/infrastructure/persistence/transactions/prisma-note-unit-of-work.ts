import { Injectable, Inject } from '@nestjs/common';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import type { INoteUnitOfWork, NoteTransactionContext } from '@modules/notes/application/ports/transactions/unit-of-work.port';
import { PrismaNoteRepository } from '@modules/notes/infrastructure/persistence/repositories/prisma-note.repository';
import { PrismaNoteShareRepository } from '@modules/notes/infrastructure/persistence/repositories/prisma-note-share.repository';
import { PrismaOutboxAdapter } from '@modules/notes/infrastructure/outbox/prisma-outbox.adapter';
import { PrismaNoteProtectionAdapter } from '@modules/notes/infrastructure/persistence/security/prisma-note-protection.adapter';
import { PrismaUserPreferencesRepository } from '@modules/notes/infrastructure/persistence/repositories/prisma-user-preferences.repository';
import { PrismaVersionHistoryRepository } from '@modules/notes/infrastructure/persistence/repositories/prisma-version-history.repository';
import { JwtConfigService } from '@config/jwt-config.service';
import { JwtService } from '@nestjs/jwt';
import type { PrismaTransactionClient } from '@modules/notes/infrastructure/persistence/types/prisma-client.type';
import { BasePrismaUnitOfWork } from '@shared/infrastructure/persistence/base-prisma-unit-of-work';
import { NOTE_INTEGRATION_EVENT_MAPPER } from '@modules/notes/application/ports/messaging/integration-event-mapper.port';
import type { NoteIntegrationEventMapper } from '@modules/notes/application/mappers/integration-event.mapper';
import type { AggregateTracker } from '@shared/domain/ddd/aggregate-tracker';

@Injectable()
export class PrismaNoteUnitOfWork extends BasePrismaUnitOfWork<NoteTransactionContext> implements INoteUnitOfWork {
  constructor(
    prisma: PrismaService,
    private readonly jwtConfigService: JwtConfigService,
    private readonly jwtService: JwtService,
    @Inject(NOTE_INTEGRATION_EVENT_MAPPER) integrationEventMapper: NoteIntegrationEventMapper,
  ) {
    super(prisma, integrationEventMapper);
  }

  protected createTransactionContext(tx: PrismaTransactionClient, tracker: AggregateTracker): NoteTransactionContext {
    return {
      repos: {
        note: new PrismaNoteRepository(tx, tracker), // Tracker injected! Fixes the critical bug
        noteShare: new PrismaNoteShareRepository(tx),
        userPreferences: new PrismaUserPreferencesRepository(tx),
        versionHistory: new PrismaVersionHistoryRepository(tx),
      },
      outbox: new PrismaOutboxAdapter(tx), // Keep for legacy/manual events if needed
      protectionPort: new PrismaNoteProtectionAdapter(tx, this.jwtService, this.jwtConfigService),
    };
  }
}
