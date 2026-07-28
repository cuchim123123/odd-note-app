import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import type { AggregateRoot } from '@shared/domain/ddd/aggregate-root';
import type { AggregateTracker } from '@shared/domain/ddd/aggregate-tracker';
import type { IDomainEventMapper } from '@shared/application/ports/domain-event-mapper.port';

export abstract class BasePrismaUnitOfWork<TContext> {
  constructor(
    protected readonly prisma: PrismaService,
    protected readonly eventMapper?: IDomainEventMapper,
  ) {}

  /**
   * Abstract method that concrete bounded contexts must implement.
   * Instantiates the context with the provided Prisma transaction client and aggregate tracker.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  protected abstract createTransactionContext(tx: any, tracker: AggregateTracker): TContext;

  /**
   * Executes the provided unit of work function within a Prisma transaction.
   * Automatically tracks aggregates, collects domain events, maps them,
   * and persists them to the generic OutboxMessage table.
   */
  async execute<TResult>(work: (ctx: TContext) => Promise<TResult>): Promise<TResult> {
    return this.prisma.$transaction(async (tx) => {
      const trackedAggregates: AggregateRoot[] = [];
      const tracker: AggregateTracker = { track: (a) => trackedAggregates.push(a) };

      const ctx = this.createTransactionContext(tx, tracker);
      const result = await work(ctx);

      if (this.eventMapper && trackedAggregates.length > 0) {
        // Collect all domain events from tracked aggregates
        const domainEvents = [];
        for (const agg of trackedAggregates) {
          domainEvents.push(...agg.domainEvents);
          agg.clearDomainEvents();
        }

        if (domainEvents.length > 0) {
          // Map domain events to OutboxMessageDrafts using the provided mapper
          const outboxMessages = this.eventMapper.map(domainEvents);
          
          if (outboxMessages.length > 0) {
            // Persist directly to OutboxMessage table using Prisma's standard delegate
            // This bypasses the need for manual context.outbox.scheduleIntegrationEvent()
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await (tx as any).outboxMessage.createMany({
              data: outboxMessages.map(msg => ({
                type: msg.type,
                topic: msg.topic,
                payload: typeof msg.payload === 'string' ? msg.payload : JSON.stringify(msg.payload),
                status: 'PENDING',
              })),
            });
          }
        }
      }

      return result;
    });
  }
}
