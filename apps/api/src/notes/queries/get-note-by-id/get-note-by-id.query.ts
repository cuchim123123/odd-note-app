export class GetNoteByIdQuery {
  constructor(
    public readonly userId: string,
    public readonly noteId: string,
    public readonly unlockToken?: string,
  ) {}
}
