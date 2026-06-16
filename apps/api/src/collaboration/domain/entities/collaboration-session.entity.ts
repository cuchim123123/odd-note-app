export class CollaborationSessionEntity {
  constructor(
    public readonly socketId: string,
    public readonly noteId: string,
    public readonly userId: string,
    public readonly displayName: string,
    public readonly color: string,
    public readonly joinedAt: Date,
  ) {}

  public isStale(timeoutMs: number): boolean {
    const now = new Date().getTime();
    return now - this.joinedAt.getTime() > timeoutMs;
  }
}
