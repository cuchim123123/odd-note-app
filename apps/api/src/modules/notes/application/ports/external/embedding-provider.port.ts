export const EMBEDDING_PROVIDER_PORT = Symbol('EmbeddingProviderPort');

export interface IEmbeddingProviderPort {
  /**
   * Generates a dense vector embedding for the given plain text.
   *
   * @param text The plain text content to embed.
   * @returns A Promise resolving to an array of floating-point numbers (the vector).
   */
  generateEmbedding(text: string): Promise<number[]>;
}
