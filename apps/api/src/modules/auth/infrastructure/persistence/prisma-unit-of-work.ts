import { Injectable, Inject } from '@nestjs/common';
import { PrismaService } from '../../../../prisma/prisma.service';
import type { UnitOfWork, TransactionContext } from '../../application/ports/unit-of-work.port';
import { PrismaUserRepository } from './prisma-user.repository';
import { PrismaTokenRepository } from './prisma-token.repository';
import { PrismaOutboxRepository } from './prisma-outbox.repository';
import type { AggregateRoot } from '../../../../common/domain/aggregate-root';
import type { AggregateTracker } from '../../../../common/domain/aggregate-tracker';
import { INTEGRATION_EVENT_MAPPER } from '../../application/ports/integration-event-mapper.port';
import type { IntegrationEventMapper } from '../../application/ports/integration-event-mapper.port';

import type { PrismaTransactionClient } from './prisma-client.type';

@Injectable()
export class PrismaUnitOfWork implements UnitOfWork {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(INTEGRATION_EVENT_MAPPER) private readonly integrationEventMapper: IntegrationEventMapper
  ) {}

  async execute<T>(work: (ctx: TransactionContext) => Promise<T>): Promise<T> {
    return this.prisma.$transaction(async (tx: PrismaTransactionClient) => {
      const trackedAggregates: AggregateRoot[] = [];
      const tracker: AggregateTracker = { track: (a) => trackedAggregates.push(a) };

      const ctx: TransactionContext = {
        userRepository: new PrismaUserRepository(tx, tracker),
        tokenRepository: new PrismaTokenRepository(tx),
        outbox: new PrismaOutboxRepository(tx),
      };
      
      const result = await work(ctx);

      // Collect all domain events
      const domainEvents = [];
      for (const agg of trackedAggregates) {
        domainEvents.push(...agg.domainEvents);
        agg.clearDomainEvents();
      }

      // Step 5: Map and persist events
      const outboxMessages = this.integrationEventMapper.map(domainEvents);
      
      for (const msg of outboxMessages) {
        await ctx.outbox.scheduleIntegrationEvent(msg.topic, msg.payload);
      }

      return result;
    });
  }
}
