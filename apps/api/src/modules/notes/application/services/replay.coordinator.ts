import { Inject, Injectable } from '@nestjs/common';
import { SNAPSHOT_METADATA_REPOSITORY, type ISnapshotMetadataRepository } from '@modules/notes/application/ports/repositories/snapshot-metadata.repository.port';
import { NOTE_UPDATE_REPOSITORY, type INoteUpdateRepository } from '@modules/notes/application/ports/repositories/note-update.repository.port';
import { SNAPSHOT_STORAGE_PORT, type ISnapshotStoragePort } from '@modules/notes/application/ports/services/snapshot-storage.port';
// import * as Y from 'yjs'; // To be used in implementation

@Injectable()
export class ReplayCoordinator {
  constructor(
    @Inject(SNAPSHOT_METADATA_REPOSITORY)
    private readonly snapshotRepository: ISnapshotMetadataRepository,
    @Inject(NOTE_UPDATE_REPOSITORY)
    private readonly updateRepository: INoteUpdateRepository,
    @Inject(SNAPSHOT_STORAGE_PORT)
    private readonly snapshotStoragePort: ISnapshotStoragePort,
  ) {}

  /**
   * Rebuilds the document state up to a specific target sequence.
   * If targetSeq is not provided, rebuilds to the absolute latest state.
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async rebuildDocument(_noteId: string, _targetSeq?: bigint): Promise<Uint8Array> {
    // 1. Find nearest snapshot <= targetSeq (or latest if targetSeq is undefined)
    // 2. Download snapshot blob from S3
    // 3. Load snapshot into Y.Doc
    // 4. Fetch updates from NoteUpdate where seq > snapshot.seq (and <= targetSeq)
    // 5. Apply updates to Y.Doc
    // 6. Return Y.encodeStateAsUpdate(ydoc)
    throw new Error('Not implemented yet');
  }

  /**
   * Retrieves the current document state. 
   * Optimization: If an active LiveYDoc exists in memory, returns it directly.
   * Otherwise, falls back to rebuildDocument().
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async getCurrentDocument(_noteId: string): Promise<Uint8Array> {
    throw new Error('Not implemented yet');
  }

  /**
   * Computes a structural diff between the current state and target state.
   * Returns a minimal Yjs update (Uint8Array) that when applied to the current state,
   * transforms it exactly into the target state.
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async computeRevertingUpdate(_currentState: Uint8Array, _targetState: Uint8Array): Promise<Uint8Array> {
    throw new Error('Not implemented yet');
  }
}
