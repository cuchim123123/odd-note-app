export class UpdateNoteMetadataCommand {
  constructor(
    public readonly userId: string,
    public readonly noteId: string,
    public readonly title?: string,
    public readonly isPinned?: boolean,
    public readonly labels?: string[],
  ) {}
}
