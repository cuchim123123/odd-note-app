export class UpdateProfileCommand {
  constructor(
    public readonly userId: string,
    public readonly input: { displayName?: string | undefined; avatarUrl?: string | null | undefined },
  ) {}
}
