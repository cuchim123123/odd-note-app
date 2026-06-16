export class RenameLabelCommand {
  constructor(
    public readonly userId: string,
    public readonly oldName: string,
    public readonly newName: string,
  ) {}
}
