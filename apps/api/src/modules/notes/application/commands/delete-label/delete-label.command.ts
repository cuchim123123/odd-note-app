export class DeleteLabelCommand {
  constructor(
    public readonly userId: string,
    public readonly labelName: string,
  ) {}
}
