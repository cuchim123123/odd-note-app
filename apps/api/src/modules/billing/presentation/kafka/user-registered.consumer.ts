import { Controller, Logger } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';
import { CommandBus } from '@nestjs/cqrs';
import { AssignFreeEntitlementCommand } from '@modules/billing/application/commands/assign-free-entitlement/assign-free-entitlement.command';

interface UserRegisteredPayload {
  userId: string;
  email: string;
  occurredOn: string;
  eventId?: string;
}

@Controller()
export class UserRegisteredConsumer {
  private readonly logger = new Logger(UserRegisteredConsumer.name);

  constructor(
    private readonly commandBus: CommandBus,
  ) {}

  @EventPattern('UserRegistered')
  async handleUserRegisteredEvent(@Payload() message: UserRegisteredPayload) {
    this.logger.log(`Handling UserRegistered Kafka event for user: ${message.userId}`);

    await this.commandBus.execute(
      new AssignFreeEntitlementCommand(
        message.userId,
        message.eventId ?? `user-registered-${message.userId}`,
      ),
    );
  }
}
