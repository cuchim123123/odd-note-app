export class CreateRevisionCommand {
  constructor(
    public readonly noteId: string,
    public readonly userId: string,
    public readonly targetSeq: bigint,
    public readonly label?: string,
  ) {}
}
