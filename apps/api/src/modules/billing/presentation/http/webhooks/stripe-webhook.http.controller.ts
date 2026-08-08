import {
  Controller,
  Post,
  Headers,
  RawBody,
  HttpCode,
  HttpStatus,
  Logger,
  BadRequestException,
  Inject,
} from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { PAYMENT_GATEWAY } from '@modules/billing/application/ports/payment-gateway.port';
import type { IPaymentGatewayPort } from '@modules/billing/application/ports/payment-gateway.port';
import { HandlePaymentSucceededCommand } from '@modules/billing/application/commands/handle-payment-succeeded/handle-payment-succeeded.command';
import { HandlePaymentFailedCommand } from '@modules/billing/application/commands/handle-payment-failed/handle-payment-failed.command';
import { HandleSubscriptionRenewedCommand } from '@modules/billing/application/commands/handle-subscription-renewed/handle-subscription-renewed.command';
import { HandleSubscriptionPaymentFailedCommand } from '@modules/billing/application/commands/handle-subscription-payment-failed/handle-subscription-payment-failed.command';
import { HandleSubscriptionCancelledCommand } from '@modules/billing/application/commands/handle-subscription-cancelled/handle-subscription-cancelled.command';
import { uuidv7 } from 'uuidv7';

/**
 * StripeWebhookHttpController — receives raw provider webhook events.
 *
 * Design:
 *  1. Gateway adapter verifies the signature and parses the raw body into a
 *     provider-neutral VerifiedWebhookEvent (Anti-Corruption Layer).
 *  2. This controller dispatches to the appropriate command handler based on event type.
 *  3. Always returns 200 to the provider — any non-200 causes Stripe to retry.
 *     Handler-level idempotency (ProcessedWebhookEvent) makes retries safe.
 *
 * Raw body requirement: NestFactory.create(AppModule, { rawBody: true }) must be set in main.ts.
 */
@Controller('billing/webhooks')
export class StripeWebhookHttpController {
  private readonly logger = new Logger(StripeWebhookHttpController.name);

  constructor(
    private readonly commandBus: CommandBus,
    @Inject(PAYMENT_GATEWAY) private readonly gateway: IPaymentGatewayPort,
  ) {}

  @Post('stripe')
  @HttpCode(HttpStatus.OK)
  async handleStripeWebhook(
    @RawBody() rawBody: Buffer,
    @Headers('stripe-signature') signature: string,
  ): Promise<{ received: boolean }> {
    if (!signature) {
      throw new BadRequestException('Missing stripe-signature header');
    }
    if (!rawBody || rawBody.length === 0) {
      throw new BadRequestException('Empty request body');
    }

    // ACL: translate raw Stripe event → provider-neutral VerifiedWebhookEvent
    // throws if signature invalid
    const event = this.gateway.parseWebhookEvent(rawBody, signature);

    // correlationId = Stripe Event-Id — threads through all downstream logs/events
    const correlationId = event.webhookEventId;
    const provider = 'stripe';

    this.logger.log(`[Webhook] Received ${event.type} (${event.webhookEventId})`);

    switch (event.type) {
      case 'payment.succeeded':
        await this.commandBus.execute(
          new HandlePaymentSucceededCommand(
            event.webhookEventId,
            event.externalId,
            provider,
            correlationId,
          ),
        );
        break;

      case 'payment.failed':
        await this.commandBus.execute(
          new HandlePaymentFailedCommand(
            event.webhookEventId,
            event.externalId,
            provider,
            event.failureReason ?? 'Unknown failure',
            correlationId,
          ),
        );
        break;

      case 'subscription.renewed':
        if (!event.stripeSubscriptionId) {
          this.logger.error(`[Webhook] subscription.renewed missing stripeSubscriptionId — ${event.webhookEventId}`);
          break;
        }
        await this.commandBus.execute(
          new HandleSubscriptionRenewedCommand(
            event.webhookEventId,
            event.stripeSubscriptionId,
            provider,
            // metadata.newPeriodEndTimestamp comes from the ACL adapter
            Number(event.metadata['newPeriodEndTimestamp'] ?? 0),
            correlationId,
          ),
        );
        break;

      case 'subscription.payment_failed':
        if (!event.stripeSubscriptionId) {
          this.logger.error(`[Webhook] subscription.payment_failed missing stripeSubscriptionId — ${event.webhookEventId}`);
          break;
        }
        await this.commandBus.execute(
          new HandleSubscriptionPaymentFailedCommand(
            event.webhookEventId,
            event.stripeSubscriptionId,
            provider,
            correlationId,
          ),
        );
        break;

      case 'subscription.cancelled':
        if (!event.stripeSubscriptionId) {
          this.logger.error(`[Webhook] subscription.cancelled missing stripeSubscriptionId — ${event.webhookEventId}`);
          break;
        }
        await this.commandBus.execute(
          new HandleSubscriptionCancelledCommand(
            event.webhookEventId,
            event.stripeSubscriptionId,
            provider,
            correlationId,
          ),
        );
        break;

      case 'payment.cancelled':
        // Checkout session expired — no action needed beyond logging
        this.logger.log(`[Webhook] Checkout session ${event.externalId} expired`);
        break;

      case 'payment.requires_action':
        // 3DS required — future: notify frontend via websocket to redirect user
        this.logger.log(`[Webhook] Payment ${event.externalId} requires 3DS action`);
        break;

      default:
        // Unknown event type — log and return 200 to prevent Stripe retries
        this.logger.warn(`[Webhook] Unhandled event type: ${event.type} (${event.webhookEventId})`);
    }

    return { received: true };
  }

  /**
   * Mock checkout simulation endpoint — local dev only.
   * Simulates a successful payment without going through Stripe.
   * POST /billing/webhooks/mock-complete with { externalId }
   */
  @Post('mock-complete')
  @HttpCode(HttpStatus.OK)
  async simulateMockPaymentSuccess(@RawBody() rawBody: Buffer): Promise<{ received: boolean }> {
    const body = JSON.parse(rawBody.toString()) as { externalId: string };
    const webhookEventId = `mock_evt_${uuidv7()}`;
    const correlationId = webhookEventId;

    await this.commandBus.execute(
      new HandlePaymentSucceededCommand(webhookEventId, body.externalId, 'mock', correlationId),
    );

    return { received: true };
  }
}
