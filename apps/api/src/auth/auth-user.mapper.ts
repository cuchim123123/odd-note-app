import { Injectable } from '@nestjs/common';
import type { User } from '@prisma/client';
import type { AuthUserProfile } from './auth.types';

@Injectable()
export class AuthUserMapper {
  toProfile(user: User): AuthUserProfile {
    return {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      role: user.role,
      isEmailVerified: user.isEmailVerified,
      avatarUrl: user.avatarUrl,
    };
  }
}
