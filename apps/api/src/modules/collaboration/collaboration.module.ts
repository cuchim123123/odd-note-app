import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule } from '@config/config.module';
import { JwtConfigModule, JwtConfigService } from '@config';
import { RedisModule } from '@shared/infrastructure/redis/redis.module';
import { PrismaModule } from '@shared/infrastructure/prisma/prisma.module';
import { NotesModule } from '@modules/notes/notes.module';

// Ports & Adapters
import { YJS_DOCUMENT_PORT } from '@modules/collaboration/application/ports/yjs-document.port';
import { YjsDocumentAdapter } from '@modules/collaboration/infrastructure/adapters/yjs-document.adapter';
import { COLLABORATION_STATE_PORT } from '@modules/collaboration/application/ports/collaboration-state.port';
import { RedisCollaborationStateAdapter } from '@modules/collaboration/infrastructure/adapters/redis-collaboration-state.adapter';
import { NOTE_ACCESS_PORT } from '@modules/collaboration/application/ports/note-access.port';
import { PrismaNoteAccessAdapter } from '@modules/collaboration/infrastructure/adapters/prisma-note-access.adapter';

// Gateways (Presentation Layer)
import { CollaborationConnectionGateway } from '@modules/collaboration/presentation/gateways/collaboration-connection.gateway';
import { CollaborationPresenceGateway } from '@modules/collaboration/presentation/gateways/collaboration-presence.gateway';
import { CollaborationYjsGateway } from '@modules/collaboration/presentation/gateways/collaboration-yjs.gateway';
import { CollaborationNoteGateway } from '@modules/collaboration/presentation/gateways/collaboration-note.gateway';

@Module({
  imports: [
    ConfigModule,
    JwtConfigModule,
    RedisModule,
    PrismaModule,
    NotesModule,
    JwtModule.registerAsync({
      imports: [JwtConfigModule],
      inject: [JwtConfigService],
      useFactory: (jwtConfig: JwtConfigService) => ({
        secret: jwtConfig.getAccessTokenSecret(),
      }),
    }),
  ],
  providers: [
    { provide: YJS_DOCUMENT_PORT, useClass: YjsDocumentAdapter },
    { provide: COLLABORATION_STATE_PORT, useClass: RedisCollaborationStateAdapter },
    { provide: NOTE_ACCESS_PORT, useClass: PrismaNoteAccessAdapter },
    CollaborationConnectionGateway,
    CollaborationPresenceGateway,
    CollaborationYjsGateway,
    CollaborationNoteGateway,
  ],
  exports: [],
})
export class CollaborationModule {}
