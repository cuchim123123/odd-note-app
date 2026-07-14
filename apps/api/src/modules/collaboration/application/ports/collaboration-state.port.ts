export const COLLABORATION_STATE_PORT = Symbol('COLLABORATION_STATE_PORT');

export type CollaboratorInfo = {
  userId: string;
  displayName: string;
  color: string;
};

export type TypingInfo = {
  userId: string;
  displayName: string;
  color: string;
  updatedAt: number;
};

export interface ICollaborationStatePort {
  // Socket -> Room mapping
  saveSocketRoom(socketId: string, noteId: string, user: CollaboratorInfo): Promise<void>;
  getSocketRoom(socketId: string): Promise<{ noteId: string; user: CollaboratorInfo } | null>;
  clearSocketRoom(socketId: string): Promise<void>;

  // Room participants
  addParticipant(noteId: string, socketId: string, user: CollaboratorInfo): Promise<void>;
  removeParticipant(noteId: string, socketId: string): Promise<void>;
  getParticipants(noteId: string): Promise<CollaboratorInfo[]>;

  // Typing state
  setTyping(noteId: string, user: CollaboratorInfo): Promise<void>;
  removeTyping(noteId: string, userId: string): Promise<void>;
  getTyping(noteId: string): Promise<TypingInfo[]>;

  // Cursors
  setCursor(noteId: string, userId: string, cursor: unknown): Promise<void>;
  removeCursor(noteId: string, userId: string): Promise<void>;
  getCursors(noteId: string): Promise<Record<string, unknown>>;
}
