export const DOCUMENT_ENGINE_PORT = Symbol('DOCUMENT_ENGINE_PORT');

export interface IDocumentEnginePort {
  /**
   * Creates an initial document state update blob from raw string content.
   */
  createInitialContent(content: string): Uint8Array;

  /**
   * Applies an update blob to an existing state blob and returns the new state.
   */
  applyUpdate(state: Uint8Array | undefined, update: Uint8Array): Uint8Array;

  /**
   * Computes a diff update to transform the current state into the target state.
   */
  computeDiff(currentState: Uint8Array, targetState: Uint8Array): Uint8Array;
}
