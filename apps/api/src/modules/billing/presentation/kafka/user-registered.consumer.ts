import { Controller, Logger } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';
import { CommandBus } from '@nestjs/cqrs';
import { AssignFreeEntitlementCommand } from '@modules/billing/application/commands/assign-free-entitlement/assign-free-entitlement.command';

import type { IntegrationEventEnvelope } from '@shared/application/ports/integration-event';

@Controller()
export class UserRegisteredConsumer {
  private readonly logger = new Logger(UserRegisteredConsumer.name);

  constructor(
    private readonly commandBus: CommandBus,
  ) {}

  @EventPattern('UserRegistered')
  async handleUserRegisteredEvent(@Payload() message: IntegrationEventEnvelope<{ email: string }>) {
    this.logger.log(`Handling UserRegistered Kafka event for user: ${message.aggregateId}`);

    await this.commandBus.execute(
      new AssignFreeEntitlementCommand(
        message.aggregateId, // aggregateId is userId for this event
        message.eventId,
      ),
    );
  }
}
