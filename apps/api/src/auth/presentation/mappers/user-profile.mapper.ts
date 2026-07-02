import { Inject, Injectable } from '@nestjs/common';
import type { User as DomainUser } from '../../domain/entities/user.entity';
import type { EnvConfig } from '../../../config/config.module';

export type AuthUserProfile = {
  id: string;
  email: string;
  displayName: string;
  isEmailVerified: boolean;
  avatarUrl: string | null;
};

/**
 * Presentation-layer mapper: converts a domain User entity into the
 * AuthUserProfile shape that is returned in HTTP responses.
 *
 * Lives in the presentation layer because the S3 URL normalization is a
 * delivery concern, not a domain concern.
 */
@Injectable()
export class UserProfileMapper {
  constructor(@Inject('ENV_CONFIG') private readonly env: EnvConfig) {}

  toProfile(user: DomainUser): AuthUserProfile {
    let avatarUrl = user.avatarUrl;

    if (avatarUrl) {
      try {
        const publicEndpoint = this.env.S3_PUBLIC_ENDPOINT || `http://localhost:${this.env.S3_PORT}`;
        const bucket = this.env.S3_BUCKET;

        const parts = avatarUrl.split('/');
        const filename = parts[parts.length - 1];
        if (filename && (avatarUrl.includes(`/${bucket}/`) || avatarUrl.includes('/uploads/'))) {
          const base = publicEndpoint.replace(/\/$/, '');
          avatarUrl = `${base}/${bucket}/${filename}`;
        }
      } catch (err) {
        console.error('Failed to normalize avatar URL:', err);
      }
    }

    return {
      id: user.id,
      email: user.email.value,
      displayName: user.displayName,
      isEmailVerified: user.isEmailVerified,
      avatarUrl,
    };
  }
}
