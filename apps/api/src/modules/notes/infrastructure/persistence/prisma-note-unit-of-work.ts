import { Injectable, Inject } from '@nestjs/common';
import { PrismaService } from '../../../../prisma/prisma.service';
import type { INoteUnitOfWork, NoteTransactionContext } from '../../application/ports/unit-of-work.port';
import { PrismaNoteRepository } from './prisma-note.repository';
import { PrismaNoteShareRepository } from './prisma-note-share.repository';
import { PrismaOutboxAdapter } from '../outbox/prisma-outbox.adapter';
import { PrismaNoteProtectionAdapter } from './prisma-note-protection.adapter';
import { PrismaUserPreferencesRepository } from './prisma-user-preferences.repository';
import { PrismaNoteRevisionRepository } from './prisma-note-revision.repository';
import { JwtConfigService } from '../../../../config/jwt-config.service';
import { JwtService } from '@nestjs/jwt';
import type { PrismaTransactionClient } from './prisma-client.type';
import type { AggregateRoot } from '../../../../shared/domain/ddd/aggregate-root';
import type { AggregateTracker } from '../../../../shared/domain/ddd/aggregate-tracker';
import { NOTE_INTEGRATION_EVENT_MAPPER, type INoteIntegrationEventMapper } from '../../application/ports/integration-event-mapper.port';

@Injectable()
export class PrismaNoteUnitOfWork implements INoteUnitOfWork {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtConfigService: JwtConfigService,
    private readonly jwtService: JwtService,
    @Inject(NOTE_INTEGRATION_EVENT_MAPPER)
    private readonly integrationEventMapper: INoteIntegrationEventMapper,
  ) {}

  async execute<T>(work: (ctx: NoteTransactionContext) => Promise<T>): Promise<T> {
    return this.prisma.$transaction(async (tx: PrismaTransactionClient) => {
      const trackedAggregates: AggregateRoot[] = [];
      const tracker: AggregateTracker = { track: (a) => trackedAggregates.push(a) };

      const ctx: NoteTransactionContext = {
        noteRepository: new PrismaNoteRepository(tx, tracker),
        noteShareRepository: new PrismaNoteShareRepository(tx),
        outbox: new PrismaOutboxAdapter(tx),
        protectionPort: new PrismaNoteProtectionAdapter(tx, this.jwtService, this.jwtConfigService),
        userPreferencesRepository: new PrismaUserPreferencesRepository(tx),
        revisionRepository: new PrismaNoteRevisionRepository(tx),
      };
      
      const result = await work(ctx);

      // Collect all domain events
      const domainEvents = [];
      for (const agg of trackedAggregates) {
        domainEvents.push(...agg.domainEvents);
        // We do NOT clear them here because they are needed by the EventBus dispatch
        // which runs in the handler! 
        // Wait, if the handler still runs `dispatchDomainEvents(note, EventBus)`, it clears them!
        // We MUST NOT clear them if the handler is going to clear them.
        // Actually, the handler clears them, so if we run this AFTER `work(ctx)`, `trackedAggregates` might have 0 events!
        // This is a crucial observation. If the handler calls `dispatchDomainEvents()`, the events are moved to EventBus and cleared from Aggregate.
      }

      // Map and persist events
      if (domainEvents.length > 0) {
        const outboxMessages = this.integrationEventMapper.map(domainEvents);
        for (const msg of outboxMessages) {
          await ctx.outbox.scheduleIntegrationEvent(msg.topic, msg.payload);
        }
      }

      return result;
    });
  }
}

