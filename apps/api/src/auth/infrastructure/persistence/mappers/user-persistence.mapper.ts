import type { User as PrismaUser } from '@prisma/client';
import { User as DomainUser } from '../../../domain/entities/user.entity';

/**
 * Maps between Prisma persistence model and the domain entity.
 * Pure static utility — no NestJS injection needed.
 */
export class UserPersistenceMapper {
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
}
