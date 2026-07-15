import type { ArgumentsHost, ExceptionFilter } from '@nestjs/common';
import { Catch } from '@nestjs/common';
import type { Response } from 'express';
import { AuthError } from '@modules/auth/domain/errors/auth-error';

const STATUS_MAP: Record<string, number> = {
  INVALID_CREDENTIALS: 401,
  USER_NOT_FOUND: 401,
  INVALID_TOKEN: 400,
  TOKEN_ALREADY_USED: 400,
  TOKEN_EXPIRED: 400,
  USER_ALREADY_EXISTS: 409,
  INCORRECT_PASSWORD: 400,
};

@Catch(AuthError)
export class AuthErrorFilter implements ExceptionFilter {
  catch(error: AuthError, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const status = STATUS_MAP[error.code] ?? 500;

    response.status(status).json({
      statusCode: status,
      message: error.message,
      error: error.code,
    });
  }
}
