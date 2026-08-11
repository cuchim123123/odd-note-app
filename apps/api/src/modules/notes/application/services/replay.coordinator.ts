import { Inject, Injectable, Logger } from '@nestjs/common';
import { SNAPSHOT_METADATA_REPOSITORY, type ISnapshotMetadataRepository } from '@modules/notes/application/ports/repositories/snapshot-metadata.repository.port';
import { DOCUMENT_UPDATE_STORE, type IDocumentUpdateStore } from '@modules/notes/application/ports/stores/document-update.store.port';
import { SNAPSHOT_STORAGE_PORT, type ISnapshotStoragePort } from '@modules/notes/application/ports/external/snapshot-storage.port';
import { DOCUMENT_ENGINE_PORT, type IDocumentEnginePort } from '@modules/notes/application/ports/external/document-engine.port';

@Injectable()
export class ReplayCoordinator {
  private readonly logger = new Logger(ReplayCoordinator.name);

  constructor(
    @Inject(SNAPSHOT_METADATA_REPOSITORY)
    private readonly snapshotRepository: ISnapshotMetadataRepository,
    @Inject(DOCUMENT_UPDATE_STORE)
    private readonly updateStore: IDocumentUpdateStore,
    @Inject(SNAPSHOT_STORAGE_PORT)
    private readonly snapshotStoragePort: ISnapshotStoragePort,
    @Inject(DOCUMENT_ENGINE_PORT)
    private readonly documentEngine: IDocumentEnginePort,
  ) {}

  /**
   * Rebuilds the document state up to `targetSeq` (inclusive).
   * If targetSeq is undefined, rebuilds to the absolute latest stored update.
   *
   * Strategy:
   *  1. Find the nearest snapshot whose snapshotSeq <= targetSeq
   *  2. Download its state blob from S3
   *  3. Fetch all NoteUpdate rows with seq > snapshotSeq (and <= targetSeq)
   *  4. Apply each update blob to the doc in strict seq order
   *  5. Return the merged, up-to-date state
   *
   * If no snapshot exists, starts from an empty doc and applies all updates.
   */
  async rebuildDocument(noteId: string, targetSeq?: bigint): Promise<Uint8Array> {
    let docState: Uint8Array | undefined;

    // Step 1 — find nearest snapshot
    const snapshotMeta = targetSeq
      ? await this.snapshotRepository.findNearestBefore(noteId, targetSeq)
      : await this.snapshotRepository.findLatest(noteId); // no upper bound — use explicit method

    const fromSeq = snapshotMeta?.snapshotSeq ?? BigInt(0);

    // Step 2 — load snapshot into docState
    if (snapshotMeta) {
      this.logger.debug(
        `[${noteId}] Loading snapshot at seq=${snapshotMeta.snapshotSeq} (key=${snapshotMeta.s3ObjectKey})`,
      );
      docState = await this.snapshotStoragePort.downloadSnapshot(snapshotMeta.s3ObjectKey);
    } else {
      this.logger.debug(`[${noteId}] No snapshot found — replaying from beginning`);
    }

    // Step 3 — fetch delta updates after the snapshot
    const updates = targetSeq
      ? await this.updateStore.getUpdatesInRange(noteId, fromSeq, targetSeq)
      : await this.updateStore.getUpdatesSince(noteId, fromSeq);

    this.logger.debug(`[${noteId}] Applying ${updates.length} updates on top of snapshot`);

    // Step 4 — apply updates in strict seq order (already ordered by repository)
    for (const update of updates) {
      docState = this.documentEngine.applyUpdate(docState, update.updateBlob);
    }

    if (!docState) {
      return this.documentEngine.createInitialContent('');
    }

    // Step 5 — return final merged state
    return docState;
  }

  /**
   * Returns the current document state.
   * This is always a full replay to the latest seq —
   * callers that need real-time state should prefer the Redis LiveDoc path.
   */
  async getCurrentDocument(noteId: string): Promise<Uint8Array> {
    return this.rebuildDocument(noteId);
  }

  /**
   * Computes the minimal update that, when applied to `currentState`,
   * transforms it exactly into `targetState`.
   *
   * Used by RestoreRevisionHandler to append a "revert" update to the op log
   * rather than overwriting history.
   */
  computeRevertingUpdate(currentState: Uint8Array, targetState: Uint8Array): Uint8Array {
    return this.documentEngine.computeDiff(currentState, targetState);
  }
}

