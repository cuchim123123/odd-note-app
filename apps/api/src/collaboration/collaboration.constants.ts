export const COLLABORATION_NAMESPACE = '/collaboration';
export const COLLABORATION_TYPING_STALE_AFTER_MS = 5000;

export const COLLABORATOR_COLORS = [
  '#ef4444',
  '#f97316',
  '#eab308',
  '#22c55e',
  '#06b6d4',
  '#3b82f6',
  '#8b5cf6',
  '#ec4899',
] as const;

export const REDIS_CHANNELS = {
  COLLABORATION_EVENTS: 'collaboration:events',
} as const;

export const REDIS_EVENT_TYPES = {
  PERMISSIONS_UPDATED: 'permissions_updated',
  NOTE_DELETED: 'note_deleted',
  NOTIFICATION_CREATED: 'notification_created',
} as const;

export const WS_EVENTS = {
  // Subscribed messages (received from client)
  JOIN: 'note:join',
  LEAVE: 'note:leave',
  UPDATE: 'note:update',
  DELETE: 'note:delete',
  TYPING: 'note:typing',
  SYNC_STEP_1: 'yjs:sync-step-1',
  SYNC_STEP_3: 'yjs:sync-step-3',
  YJS_UPDATE: 'yjs:update',

  // Emitted messages (sent to client/broadcast)
  PERMISSIONS_UPDATED: 'note:permissions_updated',
  NOTE_DELETED: 'note:deleted',
  NOTIFICATION_NEW: 'notification:new',
  COLLABORATOR_JOINED: 'collaborator:joined',
  COLLABORATOR_LEFT: 'collaborator:left',
  COLLABORATORS_LIST: 'collaborators:list',
  PRESENCE_LIST: 'presence:list',
  TYPING_LIST: 'typing:list',
  NOTE_UPDATED: 'note:updated',
  SYNC_STEP_2: 'yjs:sync-step-2',
} as const;

export const REDIS_KEYS = {
  SOCKET_PREFIX: 'collab:socket:',
  PARTICIPANTS: (noteId: string) => `collab:note:${noteId}:participants`,
  TYPING: (noteId: string) => `collab:note:${noteId}:typing`,
  SNAPSHOT: (noteId: string) => `collab:note:${noteId}:snapshot`,
} as const;
