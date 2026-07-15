import type { User as PrismaUser } from '@prisma/client';
import { User as DomainUser } from '@modules/auth/domain/entities/user.entity';
import { EmailAddress } from '@modules/auth/domain/value-objects/email-address';

/**
 * Maps between Prisma persistence model and the domain entity.
 * Pure static utility — no NestJS injection needed.
 */
export class UserPersistenceMapper {
  static toDomain(prismaUser: PrismaUser): DomainUser {
    return new DomainUser(
      prismaUser.id,
      EmailAddress.create(prismaUser.email),
      prismaUser.displayName,
      prismaUser.passwordHash,
      prismaUser.isEmailVerified,
      prismaUser.avatarUrl,
      prismaUser.createdAt,
      prismaUser.updatedAt,
    );
  }
}
