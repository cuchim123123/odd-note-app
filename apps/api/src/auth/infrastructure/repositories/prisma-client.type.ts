import type { PrismaClient } from '@prisma/client';

/**
 * The subset of PrismaClient that a Prisma interactive transaction client provides.
 * Both PrismaService (extends PrismaClient) and the `tx` parameter in
 * `prisma.$transaction(async (tx) => ...)` satisfy this type.
 */
export type PrismaTransactionClient = Omit<
  PrismaClient,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>;
