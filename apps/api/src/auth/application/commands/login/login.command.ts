import type { LoginInput } from '@odd-note-app/validation';

export class LoginCommand {
  constructor(public readonly input: LoginInput) {}
}
