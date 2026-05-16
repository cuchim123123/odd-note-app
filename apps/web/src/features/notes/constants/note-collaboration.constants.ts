export const NOTE_COLLABORATION_NAMESPACE = '/collaboration';
export const NOTE_COLLABORATION_FRAGMENT_NAME = 'prosemirror';

export const NOTE_COLLABORATION_EVENTS = {
  join: 'note:join',
  leave: 'note:leave',
  update: 'note:update',
  typing: 'note:typing',
  syncStep1: 'yjs:sync-step-1',
  syncStep2: 'yjs:sync-step-2',
  syncStep3: 'yjs:sync-step-3',
  yjsUpdate: 'yjs:update',
} as const;

export const NOTE_COLLABORATION_SYNC_JOIN_DELAY_MS = 50;
export const NOTE_COLLABORATION_SYNC_RETRY_DELAY_MS = 100;
export const NOTE_COLLABORATION_REFRESH_RETRY_DELAY_MS = 1000;
export const NOTE_COLLABORATION_REFRESH_MAX_ATTEMPTS = 10;
export const NOTE_COLLABORATION_RECONNECT_DELAY_MS = 1000;

export const NOTE_COLLABORATOR_COLORS = [
  '#ef4444',
  '#f97316',
  '#eab308',
  '#22c55e',
  '#06b6d4',
  '#3b82f6',
  '#8b5cf6',
  '#ec4899',
] as const;
