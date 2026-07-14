import { Catch, HttpStatus, Logger } from '@nestjs/common';
import type { ArgumentsHost } from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';
import { DomainError } from '../../../domain/errors/domain-error';

/**
 * Global exception filter that maps domain errors to appropriate HTTP responses.
 *
 * This keeps NestJS HTTP concern (status codes) OUT of command handlers,
 * which are transport-agnostic application layer services.
 *
 * Mapping rules:
 *  *_NOT_FOUND, *_PERMISSION_DENIED   → 404 (obfuscates resource existence on auth failures)
 *  *_ALREADY_*,  INVALID_*            → 400
 *  Everything else                    → falls through to NestJS default handler
 */
@Catch(DomainError)
export class DomainExceptionFilter extends BaseExceptionFilter {
  private readonly logger = new Logger(DomainExceptionFilter.name);

  override catch(exception: DomainError, host: ArgumentsHost) {
    const status = this.resolveStatus(exception.code);
    this.logger.debug(`DomainError [${exception.code}] → HTTP ${status}: ${exception.message}`);

    const ctx = host.switchToHttp();
    const response = ctx.getResponse<{ status: (code: number) => { json: (body: unknown) => void } }>();
    response.status(status).json({
      statusCode: status,
      error: exception.code,
      message: exception.message,
    });
  }

  private resolveStatus(code: string): number {
    if (
      code.endsWith('_NOT_FOUND') ||
      code.endsWith('_PERMISSION_DENIED') ||
      code === 'RECIPIENT_NOT_FOUND'
    ) {
      return HttpStatus.NOT_FOUND;
    }
    if (code === 'INCORRECT_PASSWORD') {
      return HttpStatus.UNAUTHORIZED;
    }
    if (
      code.startsWith('INVALID_') ||
      code.includes('_ALREADY_') ||
      code === 'NOTE_ALREADY_SHARED' ||
      code === 'SELF_SHARE_NOT_ALLOWED'
    ) {
      return HttpStatus.BAD_REQUEST;
    }
    return HttpStatus.INTERNAL_SERVER_ERROR;
  }
}
