export class NoteContentSnapshotTakenEvent {
  constructor(
    public readonly noteId: string,
    public readonly title: string,
    public readonly content: string,
    public readonly createdBy: string,
    public readonly label?: string,
  ) {}
}
