import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import type { INoteUnitOfWork, NoteTransactionContext } from '../../application/ports/unit-of-work.port';
import { PrismaNoteRepository } from './prisma-note.repository';
import { PrismaNoteShareRepository } from './prisma-note-share.repository';
import { PrismaOutboxAdapter } from '../outbox/prisma-outbox.adapter';
import { PrismaNoteProtectionAdapter } from './prisma-note-protection.adapter';
import { PrismaUserPreferencesRepository } from './prisma-user-preferences.repository';
import { PrismaNoteRevisionRepository } from './prisma-note-revision.repository';
import { JwtConfigService } from '../../../config/jwt-config.service';
import { JwtService } from '@nestjs/jwt';

import type { PrismaTransactionClient } from './prisma-client.type';

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
      
      const result = await work(ctx);

      return result;
    });
  }
}
