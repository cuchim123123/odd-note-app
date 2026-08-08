export class AssignFreeEntitlementCommand {
  constructor(
    public readonly userId: string,
    public readonly correlationId: string,
  ) {}
}
