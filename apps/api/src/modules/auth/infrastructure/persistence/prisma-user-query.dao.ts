import { Injectable } from '@nestjs/common';
import { PrismaService } from '@infrastructure/prisma/prisma.service';
import type { IUserQueryDao, UserView } from '@modules/auth/application/ports/user-query.dao.port';

@Injectable()
export class PrismaUserQueryDao implements IUserQueryDao {
  constructor(private readonly prisma: PrismaService) {}

  async findById(userId: string): Promise<UserView | null> {
    const row = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        displayName: true,
        isEmailVerified: true,
        avatarUrl: true,
      },
    });

    if (!row) return null;

    return {
      id: row.id,
      email: row.email,
      displayName: row.displayName ?? '',
      isEmailVerified: row.isEmailVerified,
      avatarUrl: row.avatarUrl,
    };
  }
}
