import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  Patch,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { z } from 'zod';
import { JwtConfigService } from '../config';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { createNoteSchema, updateNoteSchema } from '@odd-note-app/validation';
import { NotesService } from './notes.service';

const noteIdSchema = z.string().trim().min(1, 'noteId is required');
const notePasswordSchema = z.object({
  password: z.string().trim().min(1, 'Password is required'),
});

type AccessTokenPayload = {
  sub?: string;
  type?: string;
};

@Controller('notes')
export class NotesController {
  constructor(
    private readonly notesService: NotesService,
    private readonly jwtService: JwtService,
    private readonly jwtConfig: JwtConfigService,
  ) {}

  @Get()
  async list(@Headers('authorization') authorizationHeader?: string) {
    const userId = this.resolveUserId(authorizationHeader);
    return await this.notesService.list(userId);
  }

  @Get(':noteId')
  async getById(@Param('noteId') noteId: string, @Headers('authorization') authorizationHeader?: string) {
    const userId = this.resolveUserId(authorizationHeader);
    return await this.notesService.getById(userId, this.parseNoteId(noteId));
  }

  @Post()
  async create(
    @Body(new ZodValidationPipe(createNoteSchema)) body: { title: string; content?: string; labels?: string[] },
    @Headers('authorization') authorizationHeader?: string,
  ) {
    const userId = this.resolveUserId(authorizationHeader);
    return await this.notesService.create(userId, body);
  }

  @Patch(':noteId')
  async update(
    @Param('noteId') noteId: string,
    @Body(new ZodValidationPipe(updateNoteSchema)) body: {
      title?: string;
      content?: string;
      isPinned?: boolean;
      isShared?: boolean;
      labels?: string[];
    },
    @Headers('authorization') authorizationHeader?: string,
  ) {
    const userId = this.resolveUserId(authorizationHeader);
    return await this.notesService.update(userId, this.parseNoteId(noteId), body);
  }

  @Delete(':noteId')
  async delete(@Param('noteId') noteId: string, @Headers('authorization') authorizationHeader?: string) {
    const userId = this.resolveUserId(authorizationHeader);
    await this.notesService.delete(userId, this.parseNoteId(noteId));
    return { removed: true };
  }

  @Get(':noteId/protection-status')
  async getProtectionStatus(
    @Param('noteId') noteId: string,
    @Headers('authorization') authorizationHeader?: string,
  ) {
    const userId = this.resolveUserId(authorizationHeader);
    return await this.notesService.getProtectionStatus(userId, this.parseNoteId(noteId));
  }

  @Post(':noteId/set-password')
  async setPassword(
    @Param('noteId') noteId: string,
    @Body(new ZodValidationPipe(notePasswordSchema)) body: { password: string },
    @Headers('authorization') authorizationHeader?: string,
  ) {
    const userId = this.resolveUserId(authorizationHeader);
    return await this.notesService.setPassword(userId, this.parseNoteId(noteId), body.password.trim());
  }

  @Post(':noteId/verify-password')
  async verifyPassword(
    @Param('noteId') noteId: string,
    @Body(new ZodValidationPipe(notePasswordSchema)) body: { password: string },
    @Headers('authorization') authorizationHeader?: string,
  ) {
    const userId = this.resolveUserId(authorizationHeader);
    return await this.notesService.verifyPassword(userId, this.parseNoteId(noteId), body.password.trim());
  }

  @Delete(':noteId/password')
  async removePassword(
    @Param('noteId') noteId: string,
    @Body(new ZodValidationPipe(notePasswordSchema)) body: { password: string },
    @Headers('authorization') authorizationHeader?: string,
  ) {
    const userId = this.resolveUserId(authorizationHeader);
    return await this.notesService.removePassword(userId, this.parseNoteId(noteId), body.password.trim());
  }

  private parseNoteId(noteId: string): string {
    const parsed = noteIdSchema.safeParse(noteId);
    if (!parsed.success) {
      throw new BadRequestException('Invalid note id');
    }
    return parsed.data;
  }

  private resolveUserId(authorizationHeader?: string): string {
    if (!authorizationHeader?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing or invalid authorization header');
    }

    const token = authorizationHeader.slice('Bearer '.length).trim();
    if (!token) {
      throw new UnauthorizedException('Missing access token');
    }

    let payload: AccessTokenPayload;
    try {
      payload = this.jwtService.verify<AccessTokenPayload>(token, {
        secret: this.jwtConfig.getAccessTokenSecret(),
      });
    } catch {
      throw new UnauthorizedException('Access token is invalid or expired');
    }

    if (!payload.sub || payload.type === 'refresh') {
      throw new UnauthorizedException('Access token is invalid or expired');
    }

    return payload.sub;
  }
}
