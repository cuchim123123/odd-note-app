import { Injectable, Inject } from '@nestjs/common';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import type { UnitOfWork, TransactionContext } from '@modules/auth/application/ports/unit-of-work.port';
import { PrismaUserRepository } from '@modules/auth/infrastructure/persistence/prisma-user.repository';
import { PrismaTokenRepository } from '@modules/auth/infrastructure/persistence/prisma-token.repository';
import { PrismaOutboxRepository } from '@modules/auth/infrastructure/persistence/prisma-outbox.repository';

import type { AggregateTracker } from '@shared/domain/ddd/aggregate-tracker';
import { INTEGRATION_EVENT_MAPPER } from '@modules/auth/application/ports/integration-event-mapper.port';
import type { AuthIntegrationEventMapper } from '@modules/auth/application/ports/integration-event-mapper.port';

import type { PrismaTransactionClient } from '@modules/auth/infrastructure/persistence/prisma-client.type';
import { BasePrismaUnitOfWork } from '@shared/infrastructure/persistence/base-prisma-unit-of-work';

@Injectable()
export class PrismaUnitOfWork extends BasePrismaUnitOfWork<TransactionContext> implements UnitOfWork {
  constructor(
    prisma: PrismaService,
    @Inject(INTEGRATION_EVENT_MAPPER) integrationEventMapper: AuthIntegrationEventMapper
  ) {
    super(prisma, integrationEventMapper);
  }

  protected createTransactionContext(tx: PrismaTransactionClient, tracker: AggregateTracker): TransactionContext {
    return {
      repos: {
        user: new PrismaUserRepository(tx, tracker),
        token: new PrismaTokenRepository(tx),
      },
      outbox: new PrismaOutboxRepository(tx),
    };
  }
}
