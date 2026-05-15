import { createParamDecorator } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import type { AccessTokenPayload } from './auth.types';

export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): string => {
    const request = context.switchToHttp().getRequest<{ user?: AccessTokenPayload }>();
    return request.user?.sub ?? '';
  },
);