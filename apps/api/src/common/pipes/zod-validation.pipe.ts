import { Injectable, BadRequestException } from '@nestjs/common';
import { ZodError } from 'zod';
import type { PipeTransform } from '@nestjs/common';
import type { ZodTypeAny } from 'zod';

@Injectable()
export class ZodValidationPipe<TSchema extends ZodTypeAny> implements PipeTransform {
  constructor(private readonly schema: TSchema) {}

  transform(value: unknown) {
    try {
      return this.schema.parse(value);
    } catch (err) {
      if (err instanceof ZodError) {
        throw new BadRequestException(err.flatten());
      }
      throw err;
    }
  }
}
