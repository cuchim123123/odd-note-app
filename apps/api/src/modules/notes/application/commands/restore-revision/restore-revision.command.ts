export class RestoreRevisionCommand {
  constructor(
    public readonly userId: string,
    public readonly noteId: string,
    public readonly revisionId: string,
    public readonly idempotencyKey?: string,
  ) {}
}
