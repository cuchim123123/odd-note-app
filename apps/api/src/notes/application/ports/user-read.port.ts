export const USER_READ_PORT = Symbol('UserReadPort');

/**
 * Minimal read-only projection of a User, containing only what the Notes module needs.
 * Deliberately thin — the Notes module must never depend on the full User domain model.
 */
export interface UserBasicInfo {
  id: string;
  email: string;
}

export interface UserDisplayInfo {
  id: string;
  displayName: string | null;
}

export interface IUserReadPort {
  /** Find a user by email. Returns null if not found. */
  findByEmail(email: string): Promise<UserBasicInfo | null>;
  /** Find a user by id. Returns null if not found. */
  findById(id: string): Promise<UserDisplayInfo | null>;
}
