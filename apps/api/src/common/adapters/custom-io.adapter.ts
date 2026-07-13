import { IoAdapter } from '@nestjs/platform-socket.io';
import type { ServerOptions } from 'socket.io';
import type { INestApplication } from '@nestjs/common';
import type { EnvConfig } from '../../config/env.validation';

export class CustomIoAdapter extends IoAdapter {
  private readonly corsOrigin: string;

  constructor(app: INestApplication, env: EnvConfig) {
    super(app);
    this.corsOrigin = env.CORS_ORIGIN;
  }

  override createIOServer(port: number, options?: ServerOptions): unknown {
    const server = super.createIOServer(port, {
      ...options,
      cors: {
        origin: this.corsOrigin,
        credentials: true,
        allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'x-note-unlock-token', 'X-Note-Unlock-Token'],
      },
    });
    return server;
  }
}
