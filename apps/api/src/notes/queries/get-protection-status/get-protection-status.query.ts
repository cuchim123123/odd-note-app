export class GetProtectionStatusQuery {
  constructor(
    public readonly userId: string,
    public readonly noteId: string,
  ) {}
}
