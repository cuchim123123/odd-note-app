export class UpdateShareCommand {
  constructor(
    public readonly userId: string,
    public readonly noteId: string,
    public readonly shareId: string,
    public readonly permission: 'READ' | 'EDIT',
  ) {}
}
