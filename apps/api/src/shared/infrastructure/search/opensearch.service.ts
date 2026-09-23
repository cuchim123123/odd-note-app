import { Injectable, Inject, Logger } from '@nestjs/common';
import type { OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Client } from '@opensearch-project/opensearch';
import type { EnvConfig } from '@config/env.validation';

/**
 * Thin wrapper around the OpenSearch client.
 *
 * Mirrors the Redis/Prisma service pattern:
 *  - Constructed once per application lifecycle
 *  - Client is created eagerly in the constructor using ENV_CONFIG
 *  - Verifies connectivity on module init (non-fatal warning on failure)
 *  - Closes the connection cleanly on module destroy
 */
@Injectable()
export class OpenSearchService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OpenSearchService.name);
  private readonly client: Client;

  constructor(@Inject('ENV_CONFIG') private readonly env: EnvConfig) {
    this.client = new Client({ node: this.env.OPENSEARCH_URL });
  }

  /** Returns the raw OpenSearch client for use by adapters. */
  getClient(): Client {
    return this.client;
  }

  /** Resolves to the fully-qualified index name for a given logical name. */
  indexName(name: string): string {
    return `${this.env.OPENSEARCH_INDEX_PREFIX}-${name}`;
  }

  async onModuleInit(): Promise<void> {
    try {
      const { body } = await this.client.ping();
      if (body) {
        this.logger.log(`Connected to OpenSearch at ${this.env.OPENSEARCH_URL}`);
        await this.initializeIndex();
      }
    } catch (error) {
      // Non-fatal: search degraded but the application still starts.
      // Avoids hard-blocking startup when OpenSearch is unavailable.
      this.logger.warn(
        `OpenSearch ping failed — search will be unavailable until connectivity is restored. ${String(error)}`,
      );
    }
  }

  private async initializeIndex(): Promise<void> {
    const indexName = this.indexName('notes');
    try {
      const { body: exists } = await this.client.indices.exists({ index: indexName });
      if (!exists) {
        this.logger.log(`Creating OpenSearch index: ${indexName}`);
        await this.client.indices.create({
          index: indexName,
          body: {
            settings: {
              'index.knn': true,
            },
            mappings: {
              properties: {
                embedding: {
                  type: 'knn_vector',
                  dimension: 1536, // OpenAI text-embedding-3-small dimension
                  method: {
                    name: 'hnsw',
                    space_type: 'cosinesimil',
                    engine: 'nmslib',
                  },
                },
                aiTags: {
                  type: 'keyword',
                },
                snapshotSeq: {
                  type: 'long',
                },
              },
            },
          },
        });
        this.logger.log(`Successfully created index: ${indexName} with k-NN settings.`);
      }
    } catch (error) {
      this.logger.error(`Failed to initialize OpenSearch index: ${indexName}`, error);
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.client.close();
  }
}
