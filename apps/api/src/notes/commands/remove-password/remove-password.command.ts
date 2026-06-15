export class RemovePasswordCommand {
  constructor(
    public readonly userId: string,
    public readonly noteId: string,
    public readonly passwordHash: string,
  ) {}
}
