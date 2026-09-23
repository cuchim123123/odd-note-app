import { Injectable, Logger } from '@nestjs/common';
import type { IEmbeddingProviderPort } from '@modules/notes/application/ports/external/embedding-provider.port';
import OpenAI from 'openai';

@Injectable()
export class OpenAIEmbeddingAdapter implements IEmbeddingProviderPort {
  private readonly logger = new Logger(OpenAIEmbeddingAdapter.name);
  private readonly openai: OpenAI;

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env['OPENAI_API_KEY'],
    });
  }

  async generateEmbedding(text: string): Promise<number[]> {
    try {
      const response = await this.openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: text,
        encoding_format: 'float',
      });

      return response.data[0]!.embedding;
    } catch (error) {
      this.logger.error('Failed to generate embedding from OpenAI', error);
      throw error; // Let the outbox retry
    }
  }
}
