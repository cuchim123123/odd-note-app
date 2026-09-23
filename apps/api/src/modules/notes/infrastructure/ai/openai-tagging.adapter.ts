import { Injectable, Logger } from '@nestjs/common';
import type { IAITaggingProviderPort } from '@modules/notes/application/ports/external/ai-tagging-provider.port';
import OpenAI from 'openai';
import { z } from 'zod';

const TaggingSchema = z.object({
  tags: z.array(z.string()).max(5).describe('An array of up to 5 relevant tags in kebab-case format'),
});

@Injectable()
export class OpenAITaggingAdapter implements IAITaggingProviderPort {
  private readonly logger = new Logger(OpenAITaggingAdapter.name);
  private readonly openai: OpenAI;

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env['OPENAI_API_KEY'],
    });
  }

  async generateTags(text: string): Promise<string[]> {
    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are an expert taxonomy categorizer. Analyze the text and generate up to 5 highly relevant tags. Output them as strict lowercase kebab-case strings without any special characters. Your output must be a valid JSON object with a single property "tags" containing an array of strings.',
          },
          {
            role: 'user',
            content: text.slice(0, 8000), // Prevent sending overly massive text to GPT-4o-mini
          },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.2, // Low temperature for deterministic tags
      });

      const content = response.choices[0]?.message.content;
      let tags: string[] = [];
      if (content) {
        try {
          const rawParsed = JSON.parse(content);
          const parsed = TaggingSchema.parse(rawParsed);
          tags = parsed.tags;
        } catch {
          // ignore parsing error
        }
      }
      
      // Clean up just in case
      return tags.map((t: string) => t.toLowerCase().replace(/[^a-z0-9-]/g, '').trim()).filter((t: string) => t.length > 0);
    } catch (error) {
      this.logger.error('Failed to generate tags from OpenAI', error);
      throw error; // Let the outbox retry
    }
  }
}
