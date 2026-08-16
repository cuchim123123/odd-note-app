import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { AccessTokenGuard } from '@shared/presentation/http/guards/access-token.guard';
import { CurrentUser } from '@shared/presentation/http/decorators/current-user.decorator';
import { SearchNotesQuery } from '@modules/notes/application/queries/search-notes/search-notes.query';

@Controller('notes')
@UseGuards(AccessTokenGuard)
export class SearchNotesHttpController {
  constructor(private readonly queryBus: QueryBus) {}

  @Get('search')
  async search(
    @CurrentUser() userId: string,
    @Query('q') q?: string,
    @Query('labels') labels?: string | string[],
    @Query('accessMode') accessMode?: 'owner' | 'shared' | 'all',
    @Query('from') from?: string,
    @Query('size') size?: string,
  ) {
    let parsedLabels: string[] | undefined;
    if (labels) {
      if (Array.isArray(labels)) {
        parsedLabels = labels;
      } else {
        parsedLabels = labels.split(',').map((l) => l.trim());
      }
    }

    const parsedFrom = from ? parseInt(from, 10) : undefined;
    const parsedSize = size ? parseInt(size, 10) : undefined;

    return this.queryBus.execute(
      new SearchNotesQuery(userId, q, parsedLabels, accessMode, parsedFrom, parsedSize),
    );
  }
}
