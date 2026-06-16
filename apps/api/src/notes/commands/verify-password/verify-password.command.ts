export class VerifyPasswordCommand {
  constructor(
    public readonly userId: string,
    public readonly noteId: string,
    public readonly password: string, // raw — adapter handles comparison
  ) {}
}
