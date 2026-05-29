import { Inject, Injectable } from '@nestjs/common';
import type { User as PrismaUser } from '@prisma/client';
import { User as DomainUser } from '../../domain/entities/user.entity';
import type { AuthUserProfile } from '../../application/auth.types';
import type { EnvConfig } from '../../../config/config.module';

@Injectable()
export class AuthUserMapper {
  constructor(@Inject('ENV_CONFIG') private readonly env: EnvConfig) {}

  toProfile(user: DomainUser): AuthUserProfile {
    let avatarUrl = user.avatarUrl;

    if (avatarUrl) {
      try {
        const publicEndpoint = this.env.S3_PUBLIC_ENDPOINT || `http://localhost:${this.env.S3_PORT}`;
        const bucket = this.env.S3_BUCKET;

        // If the URL contains the bucket or uploads segment, reconstruct it using current config
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
      email: user.email,
      displayName: user.displayName,
      role: user.role,
      isEmailVerified: user.isEmailVerified,
      avatarUrl,
    };
  }

  static toDomain(prismaUser: PrismaUser): DomainUser {
    return new DomainUser(
      prismaUser.id,
      prismaUser.email,
      prismaUser.displayName,
      prismaUser.passwordHash,
      prismaUser.role,
      prismaUser.isEmailVerified,
      prismaUser.avatarUrl,
      prismaUser.createdAt,
      prismaUser.updatedAt,
    );
  }

  static toPersistence(domainUser: DomainUser): PrismaUser {
    return {
      id: domainUser.id,
      email: domainUser.email,
      displayName: domainUser.displayName,
      passwordHash: domainUser.passwordHash,
      role: domainUser.role,
      isEmailVerified: domainUser.isEmailVerified,
      avatarUrl: domainUser.avatarUrl,
      createdAt: domainUser.createdAt,
      updatedAt: domainUser.updatedAt,
    };
  }
}
