export class UpdateNoteAITagsCommand {
  constructor(
    public readonly noteId: string,
    public readonly aiTags: string[],
    public readonly snapshotSeq: string,
  ) {}
}
