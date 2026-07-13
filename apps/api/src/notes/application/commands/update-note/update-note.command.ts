export class UpdateNoteCommand {
  constructor(
    public readonly userId: string,
    public readonly noteId: string,
    public readonly title?: string,
    public readonly content?: string,
    public readonly isPinned?: boolean,
    public readonly isShared?: boolean,
    public readonly labels?: string[],
    public readonly unlockToken?: string,
  ) {}
}
