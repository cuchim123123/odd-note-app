export const YJS_DOCUMENT_PORT = Symbol('YJS_DOCUMENT_PORT');

export interface IYjsDocumentPort {
  /**
   * Retrieves the current Yjs document state vector.
   * @param noteId The ID of the note
   * @returns The state vector as a Uint8Array, or undefined if no active document
   */
  getStateVector(noteId: string): Promise<Uint8Array | undefined>;

  /**
   * Applies an update to the Yjs document.
   * @param noteId The ID of the note
   * @param update The update to apply as a Uint8Array
   */
  applyUpdate(noteId: string, update: Uint8Array): Promise<void>;

  /**
   * Encodes the document state as an update for synchronization.
   * @param noteId The ID of the note
   * @param stateVector Optional state vector of the client requesting the update
   */
  encodeStateAsUpdate(noteId: string, stateVector?: Uint8Array): Promise<Uint8Array | undefined>;

  /**
   * Destroys the document instance, freeing memory.
   * @param noteId The ID of the note
   */
  destroyDocument(noteId: string): Promise<void>;
}
