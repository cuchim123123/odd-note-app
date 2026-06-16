import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { z } from 'zod';
import { JwtConfigService } from '../config';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';

import { NotesService } from './notes.service';
import { NotesShareService } from './notes-share.service';
import { NotesProtectionService } from './notes-protection.service';

const noteIdSchema = z.string().trim().min(1, 'noteId is required');



type AccessTokenPayload = {
  sub?: string;
  type?: string;
};

@Controller('notes')
export class NotesController {
  constructor(
    private readonly notesService: NotesService,
    private readonly notesShareService: NotesShareService,
    private readonly notesProtectionService: NotesProtectionService,
    private readonly jwtService: JwtService,
    private readonly jwtConfig: JwtConfigService,
  ) {}

  @Get()
  async list(@Headers('authorization') authorizationHeader?: string) {
    const userId = this.resolveUserId(authorizationHeader);
    return await this.notesService.list(userId);
  }

  @Get('shared-with-me')
  async sharedWithMe(@Headers('authorization') authorizationHeader?: string) {
    const userId = this.resolveUserId(authorizationHeader);
    return await this.notesService.listSharedWithMe(userId);
  }

  @Get(':noteId')
  async getById(
    @Param('noteId') noteId: string,
    @Headers('authorization') authorizationHeader?: string,
    @Headers('x-note-unlock-token') unlockToken?: string,
  ) {
    const userId = this.resolveUserId(authorizationHeader);
    return await this.notesService.getById(userId, this.parseNoteId(noteId), unlockToken);
  }







  @Get(':noteId/shares')
  async listShares(@Param('noteId') noteId: string, @Headers('authorization') authorizationHeader?: string) {
    const userId = this.resolveUserId(authorizationHeader);
    return await this.notesShareService.listShares(userId, this.parseNoteId(noteId));
  }







  @Get(':noteId/protection-status')
  async getProtectionStatus(
    @Param('noteId') noteId: string,
    @Headers('authorization') authorizationHeader?: string,
  ) {
    const userId = this.resolveUserId(authorizationHeader);
    return await this.notesProtectionService.getProtectionStatus(userId, this.parseNoteId(noteId));
  }


  @Post('labels/rename')
  async renameLabel(
    @Body(new ZodValidationPipe(z.object({ oldName: z.string(), newName: z.string() }))) body: { oldName: string; newName: string },
    @Headers('authorization') authorizationHeader?: string,
  ) {
    const userId = this.resolveUserId(authorizationHeader);
    return await this.notesService.renameLabel(userId, body.oldName, body.newName);
  }

  @Delete('labels/:labelName')
  async deleteLabel(
    @Param('labelName') labelName: string,
    @Headers('authorization') authorizationHeader?: string,
  ) {
    const userId = this.resolveUserId(authorizationHeader);
    return await this.notesService.deleteLabel(userId, labelName);
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
