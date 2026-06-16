import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { AccessTokenGuard } from '../../../common/guards/access-token.guard';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { GetProtectionStatusQuery } from './get-protection-status.query';

@Controller('notes')
@UseGuards(AccessTokenGuard)
export class GetProtectionStatusHttpController {
  constructor(private readonly queryBus: QueryBus) {}

  @Get(':noteId/protection-status')
  async getProtectionStatus(
    @CurrentUser() userId: string,
    @Param('noteId') noteId: string,
  ) {
    return this.queryBus.execute(new GetProtectionStatusQuery(userId, noteId));
  }
}
