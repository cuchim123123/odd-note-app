export class IntegrationEvent {
  constructor(
    public readonly topic: string,
    public readonly payload: Record<string, unknown>,
  ) {}
}
