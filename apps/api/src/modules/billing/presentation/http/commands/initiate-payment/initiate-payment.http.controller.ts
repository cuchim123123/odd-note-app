import { Controller, Post, Body, UseGuards, Req, HttpCode, HttpStatus } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import type { Request } from 'express';
import { AccessTokenGuard } from '@shared/presentation/http/guards/access-token.guard';
import { InitiatePaymentCommand } from '@modules/billing/application/commands/initiate-payment/initiate-payment.command';
import type { InitiatePaymentResult } from '@modules/billing/application/commands/initiate-payment/initiate-payment.handler';
import { InitiatePaymentRequestDto } from '@modules/billing/presentation/http/commands/initiate-payment/initiate-payment.request.dto';

@Controller('billing')
export class InitiatePaymentHttpController {
  constructor(private readonly commandBus: CommandBus) {}

  @Post('payments/initiate')
  @UseGuards(AccessTokenGuard)
  @HttpCode(HttpStatus.CREATED)
  async initiatePayment(
    @Body() dto: InitiatePaymentRequestDto,
    @Req() req: Request & { user: { userId: string } },
  ): Promise<InitiatePaymentResult> {
    // correlationId: use X-Request-ID header if present, otherwise fall back to request IP + timestamp
    const correlationId =
      (req.headers['x-request-id'] as string | undefined) ?? `${req.ip}-${Date.now()}`;

    return this.commandBus.execute<InitiatePaymentCommand, InitiatePaymentResult>(
      new InitiatePaymentCommand(
        req.user.userId,
        dto.planId,
        dto.idempotencyKey,
        correlationId,
      ),
    );
  }
}
