export class GetDraftQuery {
  constructor(
    public readonly userId: string,
    public readonly noteId: string,
    public readonly unlockToken?: string,
  ) {}
}
