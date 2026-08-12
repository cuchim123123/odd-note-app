/**
 * Base fields required on every integration event consumed by projection consumers.
 * The outbox IntegrationEventMapper must include these in all published payloads.
 */
export interface ProjectionEventBase {
  /** UUIDv7 — idempotency key, unique per event occurrence */
  readonly eventId: string;
  /** Aggregate ID (noteId for note events) */
  readonly aggregateId: string;
  /** Monotonic version of the aggregate at the time this event was emitted */
  readonly aggregateVersion: number;
  /** ISO-8601 timestamp */
  readonly occurredAt: string;
}

// ── Note lifecycle events ────────────────────────────────────────────────────

export interface NoteCreatedProjectionEvent extends ProjectionEventBase {
  readonly type: 'NoteCreated';
  readonly userId: string;
  readonly title: string;
}

export interface NoteDeletedProjectionEvent extends ProjectionEventBase {
  readonly type: 'NoteDeleted';
}

export interface NoteTitleUpdatedProjectionEvent extends ProjectionEventBase {
  readonly type: 'NoteTitleUpdated';
  readonly title: string;
}

export interface NoteProtectionSetProjectionEvent extends ProjectionEventBase {
  readonly type: 'NoteProtectionSet';
}

export interface NoteProtectionRemovedProjectionEvent extends ProjectionEventBase {
  readonly type: 'NoteProtectionRemoved';
}

export interface NotePinnedProjectionEvent extends ProjectionEventBase {
  readonly type: 'NotePinned';
  readonly userId: string;
  readonly isPinned: boolean;
}

export interface NoteLabelsUpdatedProjectionEvent extends ProjectionEventBase {
  readonly type: 'NoteLabelsUpdated';
  readonly userId: string;
  readonly labels: string[];
}

// ── Share events ─────────────────────────────────────────────────────────────

export interface NoteSharedProjectionEvent extends ProjectionEventBase {
  readonly type: 'NoteShared';
  readonly shareId: string;
  readonly recipientId: string | null;
  readonly recipientEmail: string;
  readonly recipientDisplayName: string | null;
  readonly permission: 'READ' | 'EDIT';
  readonly sharedAt: string;
}

export interface ShareUpdatedProjectionEvent extends ProjectionEventBase {
  readonly type: 'ShareUpdated';
  readonly shareId: string;
  readonly permission: 'READ' | 'EDIT';
}

export interface ShareRevokedProjectionEvent extends ProjectionEventBase {
  readonly type: 'ShareRevoked';
  readonly shareId: string;
}

// ── Revision events ──────────────────────────────────────────────────────────

export interface NoteRevisionCreatedProjectionEvent extends ProjectionEventBase {
  readonly type: 'NoteRevisionCreated';
  readonly revisionId: string;
  readonly targetSeq: string; // BigInt as string
  readonly label: string | null;
  readonly createdBy: string;
}

export type NoteProjectionEvent =
  | NoteCreatedProjectionEvent
  | NoteDeletedProjectionEvent
  | NoteTitleUpdatedProjectionEvent
  | NoteProtectionSetProjectionEvent
  | NoteProtectionRemovedProjectionEvent
  | NotePinnedProjectionEvent
  | NoteLabelsUpdatedProjectionEvent;

export type ShareProjectionEvent =
  | NoteSharedProjectionEvent
  | ShareUpdatedProjectionEvent
  | ShareRevokedProjectionEvent;
