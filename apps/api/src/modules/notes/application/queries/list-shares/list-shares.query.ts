export class ListSharesQuery {
  constructor(
    public readonly userId: string,
    public readonly noteId: string,
  ) {}
}
