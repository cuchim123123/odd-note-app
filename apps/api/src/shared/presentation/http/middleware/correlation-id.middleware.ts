import { Injectable } from '@nestjs/common';
import type { NestMiddleware } from '@nestjs/common';
import type { Request, Response, NextFunction } from 'express';
import { uuidv7 } from 'uuidv7';

/**
 * CorrelationIdMiddleware — assigns a unique X-Correlation-Id to every request.
 * If the client provides X-Request-ID, that value is used instead.
 * The ID is attached to the response header and made available on req.correlationId
 * for injection into commands, UoW, and log context.
 */
@Injectable()
export class CorrelationIdMiddleware implements NestMiddleware {
  use(req: Request & { correlationId?: string }, res: Response, next: NextFunction): void {
    const correlationId =
      (req.headers['x-request-id'] as string | undefined) ??
      (req.headers['x-correlation-id'] as string | undefined) ??
      uuidv7();

    req.correlationId = correlationId;
    res.setHeader('x-correlation-id', correlationId);
    next();
  }
}
