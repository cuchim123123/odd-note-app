import { Injectable } from '@nestjs/common';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import type { INoteUnitOfWork, NoteTransactionContext } from '@modules/notes/application/ports/repositories/unit-of-work.port';
import { PrismaNoteRepository } from '@modules/notes/infrastructure/persistence/prisma-note.repository';
import { PrismaNoteShareRepository } from '@modules/notes/infrastructure/persistence/prisma-note-share.repository';
import { PrismaOutboxAdapter } from '@modules/notes/infrastructure/outbox/prisma-outbox.adapter';
import { PrismaNoteProtectionAdapter } from '@modules/notes/infrastructure/persistence/prisma-note-protection.adapter';
import { PrismaUserPreferencesRepository } from '@modules/notes/infrastructure/persistence/prisma-user-preferences.repository';
import { PrismaNoteRevisionRepository } from '@modules/notes/infrastructure/persistence/prisma-note-revision.repository';
import { JwtConfigService } from '@config/jwt-config.service';
import { JwtService } from '@nestjs/jwt';
import type { PrismaTransactionClient } from '@modules/notes/infrastructure/persistence/prisma-client.type';

@Injectable()
export class PrismaNoteUnitOfWork implements INoteUnitOfWork {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtConfigService: JwtConfigService,
    private readonly jwtService: JwtService,
  ) {}

  async execute<T>(work: (ctx: NoteTransactionContext) => Promise<T>): Promise<T> {
    return this.prisma.$transaction(async (tx: PrismaTransactionClient) => {
      const ctx: NoteTransactionContext = {
        noteRepository: new PrismaNoteRepository(tx),
        noteShareRepository: new PrismaNoteShareRepository(tx),
        outbox: new PrismaOutboxAdapter(tx),
        protectionPort: new PrismaNoteProtectionAdapter(tx, this.jwtService, this.jwtConfigService),
        userPreferencesRepository: new PrismaUserPreferencesRepository(tx),
        revisionRepository: new PrismaNoteRevisionRepository(tx),
      };
      
      return work(ctx);
    });
  }
}

