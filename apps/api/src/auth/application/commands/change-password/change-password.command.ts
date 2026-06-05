export class ChangePasswordCommand {
  constructor(
    public readonly userId: string,
    public readonly input: { oldPassword?: string; newPassword?: string },
  ) {}
}
