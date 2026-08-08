import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const initiatePaymentSchema = z.object({
  /** Must be an active plan ID from the catalog: 'free', 'premium_monthly', 'premium_annual' */
  planId: z.string().min(1).max(64),
  /**
   * Client-generated unique key for this payment attempt (UUID recommended).
   * Reusing the same key returns the existing payment — safe to retry.
   */
  idempotencyKey: z.string().min(8).max(64),
});

export class InitiatePaymentRequestDto extends createZodDto(initiatePaymentSchema) {}

