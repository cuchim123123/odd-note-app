export class GetNotificationsQuery {
  constructor(
    public readonly userId: string,
    public readonly limit: number = 50,
    public readonly cursor?: string,
    public readonly isRead?: boolean,
  ) {}
}
