export class ShareNoteCommand {
  constructor(
    public readonly userId: string,
    public readonly noteId: string,
    public readonly recipientEmail: string,
    public readonly permission: 'READ' | 'EDIT',
  ) {}
}
