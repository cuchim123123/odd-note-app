import { AggregateRoot } from '../../../common/ddd/aggregate-root';
import { NoteTitle } from '../value-objects/note-title.vo';
import { NotePermissionDeniedError, NoteAlreadySharedError } from '../errors/note.errors';
import { SharePermission } from '../value-objects/share-permission.vo';
import { NoteCreatedDomainEvent } from '../events/note-created.domain-event';
import { NoteDeletedDomainEvent } from '../events/note-deleted.domain-event';
import { NoteSharedDomainEvent } from '../events/note-shared.domain-event';
import { NoteShareUpdatedDomainEvent } from '../events/note-share-updated.domain-event';
import { NoteShareRevokedDomainEvent } from '../events/note-share-revoked.domain-event';
import { NotePasswordSetDomainEvent } from '../events/note-password-set.domain-event';
import { NotePasswordRemovedDomainEvent } from '../events/note-password-removed.domain-event';
import { NoteId, UserId, ShareId } from '../../../common/ddd/id-types';
import * as crypto from 'crypto';

export interface NoteShare {
  id: ShareId;
  recipientId: UserId;
  recipientEmail: string;
  permission: SharePermission;
}

export interface NoteProps {
  ownerId: UserId;
  title: NoteTitle;
  isShared: boolean;
  shares: NoteShare[];
  isProtected: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export class NoteEntity extends AggregateRoot {
  private readonly _id: NoteId;
  private readonly props: NoteProps;

  private constructor(props: NoteProps, id?: NoteId) {
    super();
    this._id = id ?? NoteId.from(crypto.randomUUID());
    this.props = props;
  }

  // ─── Getters return plain string to keep infrastructure layer clean ───────

  get id(): string { return this._id; }
  get ownerId(): string { return this.props.ownerId; }
  get title(): string { return this.props.title.value; }
  get isShared(): boolean { return this.props.isShared; }
  get shares(): ReadonlyArray<NoteShare> { return this.props.shares; }
  get isProtected(): boolean { return this.props.isProtected; }
  get createdAt(): Date { return this.props.createdAt; }
  get updatedAt(): Date { return this.props.updatedAt; }

  // ─── Factory methods ───────────────────────────────────────────────────────

  public static create(ownerId: string, title: NoteTitle): NoteEntity {
    const typedOwnerId = UserId.from(ownerId);
    const note = new NoteEntity({
      ownerId: typedOwnerId,
      title,
      isShared: false,
      shares: [],
      isProtected: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    note.addDomainEvent(new NoteCreatedDomainEvent(note.id, ownerId, title.value));
    return note;
  }

  public static load(id: string, props: Omit<NoteProps, 'ownerId'> & { ownerId: string }): NoteEntity {
    return new NoteEntity(
      { ...props, ownerId: UserId.from(props.ownerId) },
      NoteId.from(id),
    );
  }

  // ─── Domain behaviours ────────────────────────────────────────────────────

  public rename(newTitle: NoteTitle, requestedBy: string): void {
    this.verifyEditPermission(requestedBy);
    this.props.title = newTitle;
    this.updateModifiedTime();
  }

  public shareWith(recipientId: string, recipientEmail: string, permission: SharePermission, requestedBy: string): void {
    this.verifyOwner(requestedBy);

    const typedRecipientId = UserId.from(recipientId);
    const existingShare = this.props.shares.find(s => s.recipientId === typedRecipientId);
    if (existingShare) {
      throw new NoteAlreadySharedError(recipientEmail);
    }

    const shareId = ShareId.from(crypto.randomUUID());
    this.props.shares.push({
      id: shareId,
      recipientId: typedRecipientId,
      recipientEmail,
      permission,
    });
    this.props.isShared = true;
    this.updateModifiedTime();

    this.addDomainEvent(new NoteSharedDomainEvent(
      this.id,
      this.ownerId,
      recipientId,
      recipientEmail,
      permission.value,
      shareId,
    ));
  }

  public updateShare(shareId: string, newPermission: SharePermission, requestedBy: string): void {
    this.verifyOwner(requestedBy);

    const share = this.props.shares.find(s => s.id === shareId);
    if (!share) {
      throw new Error(`Share ${shareId} not found`);
    }

    if (share.permission.equals(newPermission)) return;

    share.permission = newPermission;
    this.updateModifiedTime();

    this.addDomainEvent(new NoteShareUpdatedDomainEvent(
      this.id,
      this.ownerId,
      share.recipientId,
      newPermission.value,
      share.id,
    ));
  }

  public revokeShare(shareId: string, requestedBy: string): void {
    this.verifyOwner(requestedBy);

    const shareIndex = this.props.shares.findIndex(s => s.id === shareId);
    if (shareIndex === -1) {
      throw new Error(`Share ${shareId} not found`);
    }

    this.props.shares.splice(shareIndex, 1);

    if (this.props.shares.length === 0) {
      this.props.isShared = false;
    }

    this.updateModifiedTime();

    this.addDomainEvent(new NoteShareRevokedDomainEvent(
      this.id,
      this.ownerId,
      shareId,
    ));
  }

  public markAsProtected(requestedBy: string): void {
    this.verifyOwner(requestedBy);
    if (this.props.isProtected) return;

    this.props.isProtected = true;
    this.addDomainEvent(new NotePasswordSetDomainEvent(this.id, this.ownerId));
  }

  public removeProtection(requestedBy: string): void {
    this.verifyOwner(requestedBy);
    if (!this.props.isProtected) return;

    this.props.isProtected = false;
    this.addDomainEvent(new NotePasswordRemovedDomainEvent(this.id, this.ownerId));
  }

  public delete(requestedBy: string): void {
    this.verifyOwner(requestedBy);
    this.addDomainEvent(new NoteDeletedDomainEvent(this.id, this.ownerId));
  }

  public hasAccess(userId: string): boolean {
    if (this.ownerId === userId) return true;
    return this.props.shares.some(s => s.recipientId === userId);
  }

  public isOwner(userId: string): boolean {
    return this.ownerId === userId;
  }

  public canEdit(userId: string): boolean {
    if (this.ownerId === userId) return true;
    return this.props.shares.some(s => s.recipientId === userId && s.permission.value === 'EDIT');
  }

  // ─── Private invariants ───────────────────────────────────────────────────

  private verifyOwner(userId: string): void {
    if (this.ownerId !== userId) {
      throw new NotePermissionDeniedError('Only the note owner can perform this action');
    }
  }

  private verifyEditPermission(userId: string): void {
    if (!this.canEdit(userId)) {
      throw new NotePermissionDeniedError('You do not have permission to edit this note');
    }
  }

  private updateModifiedTime(): void {
    this.props.updatedAt = new Date();
  }
}
