export interface OutboxPort {
  scheduleInternalCommand(topic: string, payload: Record<string, unknown>): Promise<void>;
  scheduleIntegrationEvent(topic: string, payload: Record<string, unknown>): Promise<void>;
}
