import type { ChangePasswordOutput } from '@odd-note-app/validation';

export type ChangePasswordCommand = {
  userId: string;
  input: ChangePasswordOutput;
};
