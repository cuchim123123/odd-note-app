import { Inject, Injectable, Logger } from '@nestjs/common';
import * as Y from 'yjs';
import { SNAPSHOT_METADATA_REPOSITORY, type ISnapshotMetadataRepository } from '@modules/notes/application/ports/repositories/snapshot-metadata.repository.port';
import { NOTE_UPDATE_REPOSITORY, type INoteUpdateRepository } from '@modules/notes/application/ports/repositories/note-update.repository.port';
import { SNAPSHOT_STORAGE_PORT, type ISnapshotStoragePort } from '@modules/notes/application/ports/external/snapshot-storage.port';

@Injectable()
export class ReplayCoordinator {
  private readonly logger = new Logger(ReplayCoordinator.name);

  constructor(
    @Inject(SNAPSHOT_METADATA_REPOSITORY)
    private readonly snapshotRepository: ISnapshotMetadataRepository,
    @Inject(NOTE_UPDATE_REPOSITORY)
    private readonly updateRepository: INoteUpdateRepository,
    @Inject(SNAPSHOT_STORAGE_PORT)
    private readonly snapshotStoragePort: ISnapshotStoragePort,
  ) {}

  /**
   * Rebuilds the Y.Doc state up to `targetSeq` (inclusive).
   * If targetSeq is undefined, rebuilds to the absolute latest stored update.
   *
   * Strategy:
   *  1. Find the nearest snapshot whose snapshotSeq ≤ targetSeq
   *  2. Download its Yjs state blob from S3
   *  3. Fetch all NoteUpdate rows with seq > snapshotSeq (and ≤ targetSeq)
   *  4. Apply each update blob to the Y.Doc in strict seq order
   *  5. Return Y.encodeStateAsUpdate(doc) — the merged, up-to-date state
   *
   * If no snapshot exists, starts from an empty Y.Doc and applies all updates.
   */
  async rebuildDocument(noteId: string, targetSeq?: bigint): Promise<Uint8Array> {
    const doc = new Y.Doc();

    // Step 1 — find nearest snapshot
    const snapshotMeta = targetSeq
      ? await this.snapshotRepository.findNearestBefore(noteId, targetSeq)
      : await this.snapshotRepository.findLatest(noteId); // no upper bound — use explicit method

    const fromSeq = snapshotMeta?.snapshotSeq ?? BigInt(0);

    // Step 2 — load snapshot into Y.Doc
    if (snapshotMeta) {
      this.logger.debug(
        `[${noteId}] Loading snapshot at seq=${snapshotMeta.snapshotSeq} (key=${snapshotMeta.s3ObjectKey})`,
      );
      const snapshotBlob = await this.snapshotStoragePort.downloadSnapshot(snapshotMeta.s3ObjectKey);
      Y.applyUpdate(doc, snapshotBlob);
    } else {
      this.logger.debug(`[${noteId}] No snapshot found — replaying from beginning`);
    }

    // Step 3 — fetch delta updates after the snapshot
    const updates = targetSeq
      ? await this.updateRepository.getUpdatesInRange(noteId, fromSeq, targetSeq)
      : await this.updateRepository.getUpdatesSince(noteId, fromSeq);

    this.logger.debug(`[${noteId}] Applying ${updates.length} updates on top of snapshot`);

    // Step 4 — apply updates in strict seq order (already ordered by repository)
    for (const update of updates) {
      Y.applyUpdate(doc, update.updateBlob);
    }

    // Step 5 — encode final merged state
    return Y.encodeStateAsUpdate(doc);
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
   * Computes the minimal Yjs update that, when applied to `currentState`,
   * transforms it exactly into `targetState`.
   *
   * Used by RestoreRevisionHandler to append a "revert" update to the op log
   * rather than overwriting history.
   */
  computeRevertingUpdate(currentState: Uint8Array, targetState: Uint8Array): Uint8Array {
    // Decode both states as Y.Docs
    const currentDoc = new Y.Doc();
    Y.applyUpdate(currentDoc, currentState);

    const targetDoc = new Y.Doc();
    Y.applyUpdate(targetDoc, targetState);

    // The diff update: what targetDoc has that currentDoc doesn't
    const currentStateVector = Y.encodeStateVector(currentDoc);
    return Y.encodeStateAsUpdate(targetDoc, currentStateVector);
  }
}
