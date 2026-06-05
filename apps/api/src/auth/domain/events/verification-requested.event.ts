export class VerificationRequestedEvent {
  constructor(
    public readonly email: string,
    public readonly displayName: string,
    public readonly verificationToken: string,
  ) {}
}
