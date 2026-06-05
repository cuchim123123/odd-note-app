import type { RegisterInput } from '@odd-note-app/validation';

export class RegisterCommand {
  constructor(public readonly input: RegisterInput) {}
}
