import { Injectable } from '@nestjs/common';
import type { INotificationUnitOfWork, NotificationTransactionContext } from '@modules/notifications/application/ports/transactions/unit-of-work.port';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import type { PrismaTransactionClient } from '@modules/auth/infrastructure/persistence/prisma-client.type'; // Standard Prisma client type
import { BasePrismaUnitOfWork } from '@shared/infrastructure/persistence/base-prisma-unit-of-work';
import type { AggregateTracker } from '@shared/domain/ddd/aggregate-tracker';
import { PrismaNotificationRepository } from '@modules/notifications/infrastructure/persistence/prisma-notification.repository';

@Injectable()
export class PrismaNotificationUnitOfWork extends BasePrismaUnitOfWork<NotificationTransactionContext> implements INotificationUnitOfWork {
  constructor(
    prisma: PrismaService,
  ) {
    super(prisma);
  }

  protected createTransactionContext(tx: PrismaTransactionClient, tracker: AggregateTracker): NotificationTransactionContext {
    return {
      repos: {
        notification: new PrismaNotificationRepository(tx, tracker),
      },
    };
  }
}
