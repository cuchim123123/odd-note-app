export class GetNoteHistoryQuery {
  constructor(
    public readonly userId: string,
    public readonly noteId: string,
  ) {}
}
