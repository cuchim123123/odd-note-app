/**
 * Branded (nominal) ID types for the notes bounded context.
 *
 * Branding makes the TypeScript type system treat NoteId and UserId as
 * incompatible even though both are strings at runtime. This eliminates an
 * entire class of silent ID-swap bugs (e.g. passing a noteId where a userId
 * is expected) without any runtime overhead.
 *
 * Usage:
 *   const id: NoteId = NoteId.from(rawString);
 *   const uid: UserId = UserId.from(rawString);
 *
 *   // TypeScript error — cannot assign NoteId to UserId:
 *   const wrong: UserId = NoteId.from('abc');
 *
 * Infrastructure layer (Prisma adapters, controllers) obtains raw strings
 * from the framework and calls .from() at the boundary before passing into
 * the domain. Getters on domain entities return the raw string via .value so
 * serialisation remains straightforward.
 */

declare const __brand: unique symbol;
type Brand<T, B> = T & { readonly [__brand]: B };

// ─── Note ID ─────────────────────────────────────────────────────────────────

export type NoteId = Brand<string, 'NoteId'>;
export const NoteId = {
  from(raw: string): NoteId {
    if (!raw || raw.trim().length === 0) {
      throw new Error('NoteId cannot be blank');
    }
    return raw as NoteId;
  },
} as const;

// ─── User ID ─────────────────────────────────────────────────────────────────

export type UserId = Brand<string, 'UserId'>;
export const UserId = {
  from(raw: string): UserId {
    if (!raw || raw.trim().length === 0) {
      throw new Error('UserId cannot be blank');
    }
    return raw as UserId;
  },
} as const;

// ─── Share ID ─────────────────────────────────────────────────────────────────

export type ShareId = Brand<string, 'ShareId'>;
export const ShareId = {
  from(raw: string): ShareId {
    if (!raw || raw.trim().length === 0) {
      throw new Error('ShareId cannot be blank');
    }
    return raw as ShareId;
  },
} as const;
