export class DeleteNotificationCommand {
  constructor(
    public readonly userId: string,
    public readonly notificationId: string,
  ) {}
}
