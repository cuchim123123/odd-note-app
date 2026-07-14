export class RevokeShareCommand {
  constructor(
    public readonly userId: string,
    public readonly noteId: string,
    public readonly shareId: string,
  ) {}
}
