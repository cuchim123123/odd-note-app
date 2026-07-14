import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { AccessTokenGuard } from '../../../../../common/presentation/http/guards/access-token.guard';
import { CurrentUser } from '../../../../../common/presentation/http/decorators/current-user.decorator';
import { GetProtectionStatusQuery } from '../../../application/queries/get-protection-status/get-protection-status.query';

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
