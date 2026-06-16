import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule } from '../config/config.module';
import { JwtConfigModule, JwtConfigService } from '../config';
import { RedisModule } from '../redis/redis.module';
import { PrismaModule } from '../prisma/prisma.module';
import { NotesModule } from '../notes/notes.module';

// Ports & Adapters
import { YJS_DOCUMENT_PORT } from './application/ports/yjs-document.port';
import { YjsDocumentAdapter } from './infrastructure/adapters/yjs-document.adapter';
import { COLLABORATION_STATE_PORT } from './application/ports/collaboration-state.port';
import { RedisCollaborationStateAdapter } from './infrastructure/adapters/redis-collaboration-state.adapter';
import { NOTE_ACCESS_PORT } from './application/ports/note-access.port';
import { PrismaNoteAccessAdapter } from './infrastructure/adapters/prisma-note-access.adapter';

// Gateways
import { CollaborationConnectionGateway } from './gateways/collaboration-connection.gateway';
import { CollaborationPresenceGateway } from './gateways/collaboration-presence.gateway';
import { CollaborationYjsGateway } from './gateways/collaboration-yjs.gateway';
import { CollaborationNoteGateway } from './gateways/collaboration-note.gateway';

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
