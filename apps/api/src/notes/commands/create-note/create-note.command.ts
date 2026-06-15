export class CreateNoteCommand {
  constructor(
    public readonly userId: string,
    public readonly title: string,
    public readonly content?: string,
    public readonly labels?: string[],
  ) {}
}
