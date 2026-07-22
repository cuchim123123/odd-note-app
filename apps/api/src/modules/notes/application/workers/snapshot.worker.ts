import { Injectable, Logger, Inject } from '@nestjs/common';
import { EventsHandler, type IEventHandler } from '@nestjs/cqrs';
import { SNAPSHOT_METADATA_REPOSITORY, type ISnapshotMetadataRepository } from '@modules/notes/application/ports/snapshot-metadata.repository.port';
import { NOTE_UPDATE_REPOSITORY, type INoteUpdateRepository } from '@modules/notes/application/ports/note-update.repository.port';
import { NOTE_OUTBOX_PORT, type INoteOutboxPort } from '@modules/notes/application/ports/note-outbox.port';

// Note: This event would typically be emitted by the Realtime Collaboration Gateway
export class NoteUpdateAppendedEvent {
  constructor(
    public readonly noteId: string,
    public readonly seq: bigint,
    public readonly sizeBytes: number,
  ) {}
}

const MAX_UPDATES_THRESHOLD = 5000;
const MAX_BYTES_THRESHOLD = 16 * 1024 * 1024; // 16 MB

@EventsHandler(NoteUpdateAppendedEvent)
@Injectable()
export class SnapshotThresholdMonitor implements IEventHandler<NoteUpdateAppendedEvent> {
  private readonly logger = new Logger(SnapshotThresholdMonitor.name);

  constructor(
    @Inject(NOTE_UPDATE_REPOSITORY)
    private readonly updateRepository: INoteUpdateRepository,
    @Inject(SNAPSHOT_METADATA_REPOSITORY)
    private readonly snapshotMetadataRepository: ISnapshotMetadataRepository,
    @Inject(NOTE_OUTBOX_PORT)
    private readonly outboxPort: INoteOutboxPort,
  ) {}

  async handle(event: NoteUpdateAppendedEvent) {
    const { noteId, seq } = event;

    // 1. Find the nearest snapshot sequence
    const latestSnapshot = await this.snapshotMetadataRepository.findNearestBefore(noteId, seq);
    const startSeq = latestSnapshot ? latestSnapshot.snapshotSeq : 0n;

    // 2. Query updates since that snapshot
    const recentUpdates = await this.updateRepository.getUpdatesInRange(noteId, startSeq, seq);
    
    // 3. Calculate metrics
    const updateCount = recentUpdates.length;
    const accumulatedBytes = recentUpdates.reduce((sum, update) => sum + update.sizeBytes, 0);

    // 4. Evaluate Threshold Rules
    if (updateCount >= MAX_UPDATES_THRESHOLD || accumulatedBytes >= MAX_BYTES_THRESHOLD) {
      this.logger.log(`Threshold reached for note ${noteId} [Updates: ${updateCount}, Size: ${accumulatedBytes}b]. Triggering Snapshot.`);
      
      // Push to Outbox Queue instead of executing in-memory!
      // This delegates the execution to a reliable queue with Retry and DLQ.
      await this.outboxPort.scheduleInternalCommand('CreateSnapshot', { 
        noteId, 
        targetSeq: seq.toString() 
      });
    }
  }
}

