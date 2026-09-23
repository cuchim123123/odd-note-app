export const AI_TAGGING_PROVIDER_PORT = Symbol('AITaggingProviderPort');

export interface IAITaggingProviderPort {
  /**
   * Generates a list of relevant tags (kebab-case) from the given plain text.
   *
   * @param text The plain text content to analyze.
   * @returns A Promise resolving to an array of string tags (e.g., ['redis', 'caching']).
   */
  generateTags(text: string): Promise<string[]>;
}
