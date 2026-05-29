import { createParamDecorator } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';

export type AccessTokenPayload = {
  sub?: string;
  type?: string;
};

export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): string => {
    const request = context.switchToHttp().getRequest<{ user?: AccessTokenPayload }>();
    return request.user?.sub ?? '';
  },
);
