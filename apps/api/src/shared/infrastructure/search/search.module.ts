import { Module } from '@nestjs/common';
import { ConfigModule } from '@config/config.module';
import { OpenSearchService } from '@shared/infrastructure/search/opensearch.service';

/**
 * SearchModule — shared infrastructure module.
 *
 * Provides OpenSearchService to any feature module that needs to read
 * from or write to the search index.
 *
 * Import this module into any feature module that declares search
 * adapters (e.g. NotesModule for NoteSearchIndexAdapter and
 * NoteSearchQueryDao).
 *
 * It is NOT marked @Global() — search is a notes-specific capability
 * and should not be auto-available everywhere (mirrors MongoModule).
 */
@Module({
  imports: [ConfigModule],
  providers: [OpenSearchService],
  exports: [OpenSearchService],
})
export class SearchModule {}
