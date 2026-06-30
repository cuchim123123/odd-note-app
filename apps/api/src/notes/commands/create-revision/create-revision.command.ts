export class CreateRevisionCommand {
  constructor(
    public readonly noteId: string,
    public readonly title: string,
    public readonly content: string,
    public readonly createdBy: string,
    /** Optional human label, e.g. "Auto-save". Defaults to "Auto-save". */
    public readonly label?: string,
  ) {}
}
