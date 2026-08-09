import { Injectable, Logger, InternalServerErrorException, BadRequestException } from '@nestjs/common';
import Stripe from 'stripe';
import type { EnvConfig } from '@config/config.module';
import { Inject } from '@nestjs/common';
import type { IPaymentGatewayPort, CreateCheckoutSessionDto, CheckoutSessionResult, VerifiedWebhookEvent, WebhookEventType } from '@modules/billing/application/ports/payment-gateway.port';
import { ProviderReference } from '@modules/billing/domain/value-objects/provider-reference.vo';

@Injectable()
export class StripePaymentGatewayAdapter implements IPaymentGatewayPort {
  private readonly stripe: Stripe;
  private readonly logger = new Logger(StripePaymentGatewayAdapter.name);
  private readonly webhookSecret: string;

  constructor(
    @Inject('ENV_CONFIG') private readonly config: EnvConfig,
  ) {
    if (!this.config.STRIPE_SECRET_KEY) {
      throw new Error('STRIPE_SECRET_KEY is required when using StripePaymentGatewayAdapter');
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this.stripe = new Stripe(this.config.STRIPE_SECRET_KEY, {} as any);
    this.webhookSecret = this.config.STRIPE_WEBHOOK_SECRET ?? '';
  }

  async createCheckoutSession(dto: CreateCheckoutSessionDto): Promise<CheckoutSessionResult> {
    const isSubscription = dto.planId.includes('monthly') || dto.planId.includes('annual');

    try {
      // NOTE: In a real implementation, you would look up the Stripe Price ID
      // based on the planId and version. For this foundation, we create inline price data.
      const session = await this.stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        mode: isSubscription ? 'subscription' : 'payment',
        client_reference_id: dto.billingEntityId,
        metadata: {
          ...dto.metadata,
          correlationId: dto.correlationId,
        },
        // We use inline price data for dynamic pricing defined in application layer
        line_items: [
          {
            price_data: {
              currency: dto.quote.currency.toLowerCase(),
              product_data: {
                name: `Plan: ${dto.planId}`,
                metadata: {
                  planId: dto.planId,
                  planVersion: dto.planVersion.toString(),
                },
              },
              unit_amount: dto.quote.amountCents,
              ...(isSubscription ? {
                recurring: { interval: dto.planId.includes('monthly') ? 'month' : 'year' }
              } : {}),
            },
            quantity: 1,
          },
        ],
        success_url: `${this.config.APP_URL ?? 'http://localhost:5173'}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${this.config.APP_URL ?? 'http://localhost:5173'}/billing/cancel`,
        // Idempotency ensures we don't create multiple Stripe sessions for the same internal attempt
      }, { idempotencyKey: dto.idempotencyKey });

      if (!session.url) {
        throw new InternalServerErrorException('Stripe did not return a checkout URL');
      }

      this.logger.log(`[Stripe] Created checkout session ${session.id} for billingEntityId=${dto.billingEntityId}`);

      return {
        providerRef: ProviderReference.of('stripe', session.id),
        checkoutUrl: session.url,
      };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      this.logger.error(`[Stripe] Error creating checkout session: ${error.message}`);
      throw new InternalServerErrorException('Failed to communicate with payment provider');
    }
  }

  parseWebhookEvent(rawBody: Buffer, signature: string): VerifiedWebhookEvent {
    if (!this.webhookSecret) {
      this.logger.warn('[Stripe] STRIPE_WEBHOOK_SECRET not configured — skipping signature verification (UNSAFE in prod!)');
    }

    let event: Stripe.Event;

    try {
      if (this.webhookSecret) {
        event = this.stripe.webhooks.constructEvent(rawBody, signature, this.webhookSecret);
      } else {
        // Fallback for missing secret in local dev (though mock adapter is better)
        event = JSON.parse(rawBody.toString()) as Stripe.Event;
      }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      this.logger.error(`[Stripe] Webhook signature verification failed: ${err.message}`);
      throw new BadRequestException(`Webhook signature verification failed: ${err.message}`);
    }

    return this.mapStripeEventToNeutral(event);
  }

  async getSessionStatus(externalId: string): Promise<'PENDING' | 'COMPLETED' | 'FAILED' | 'EXPIRED'> {
    try {
      const session = await this.stripe.checkout.sessions.retrieve(externalId);
      
      if (session.payment_status === 'paid') return 'COMPLETED';
      if (session.status === 'expired') return 'EXPIRED';
      if (session.status === 'complete' && session.payment_status !== 'paid') return 'FAILED';
      
      return 'PENDING';
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      this.logger.error(`[Stripe] Error retrieving session ${externalId}: ${err.message}`);
      return 'PENDING';
    }
  }

  private mapStripeEventToNeutral(event: Stripe.Event): VerifiedWebhookEvent {
    let type: WebhookEventType | 'UNKNOWN' = 'UNKNOWN';
    let externalId = '';
    let stripeSubscriptionId: string | null = null;
    let failureReason: string | null = null;
    let metadata: Record<string, string> = {};

    switch (event.type) {
      case 'checkout.session.completed':
      case 'checkout.session.async_payment_succeeded': {
        const session = event.data.object as Stripe.Checkout.Session;
        type = 'payment.succeeded';
        externalId = session.id;
        stripeSubscriptionId = typeof session.subscription === 'string' ? session.subscription : null;
        metadata = session.metadata ?? {};
        break;
      }
      
      case 'checkout.session.async_payment_failed': {
        const session = event.data.object as Stripe.Checkout.Session;
        type = 'payment.failed';
        externalId = session.id;
        failureReason = 'async_payment_failed';
        metadata = session.metadata ?? {};
        break;
      }

      case 'checkout.session.expired': {
        const session = event.data.object as Stripe.Checkout.Session;
        type = 'payment.cancelled';
        externalId = session.id;
        break;
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice;
        if (invoice.billing_reason === 'subscription_cycle' || invoice.billing_reason === 'subscription_update') {
          type = 'subscription.renewed';
          externalId = invoice.id;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const subId = (invoice as any).subscription;
          stripeSubscriptionId = typeof subId === 'string' ? subId : null;
          // Extract the new period end for the subscription
          metadata = {
            ...invoice.metadata,
            newPeriodEndTimestamp: invoice.lines.data[0]?.period?.end?.toString() ?? '0',
          };
        }
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        type = 'subscription.payment_failed';
        externalId = invoice.id;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const subId = (invoice as any).subscription;
        stripeSubscriptionId = typeof subId === 'string' ? subId : null;
        failureReason = 'invoice_payment_failed';
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        type = 'subscription.cancelled';
        externalId = subscription.id;
        stripeSubscriptionId = subscription.id;
        break;
      }

      default:
        // Other events will be dropped by the WebhookController returning 200
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        type = 'UNKNOWN' as any; // Cast safely bypassed in controller fallback
    }

    return {
      webhookEventId: event.id,
      type: type as WebhookEventType,
      externalId,
      stripeSubscriptionId,
      failureReason,
      metadata,
    };
  }
}
