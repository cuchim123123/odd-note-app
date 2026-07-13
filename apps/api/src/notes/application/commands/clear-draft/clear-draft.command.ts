export class ClearDraftCommand {
  constructor(
    public readonly userId: string,
    public readonly noteId: string,
  ) {}
}
