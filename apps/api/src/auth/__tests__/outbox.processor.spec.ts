import { beforeEach, describe, expect, it, vi } from 'vitest';
import { of, throwError } from 'rxjs';
import { OutboxProcessor } from '../../common/infrastructure/outbox/outbox.processor';
import { AuthInternalCommandHandler } from '../infrastructure/messaging/auth-internal-command.handler';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function buildOutboxMessage(overrides: Partial<{
  id: string;
  type: string;
  topic: string;
  payload: string;
  status: string;
  retryCount: number;
  nextRetryAt: Date | null;
  deadLetteredAt: Date | null;
  createdAt: Date;
  processedAt: Date | null;
}> = {}) {
  return {
    id: 'msg-1',
    type: 'INTEGRATION_EVENT',
    topic: 'NoteShared',
    payload: JSON.stringify({ noteId: 'note-1', recipientId: 'user-2' }),
    status: 'PENDING',
    retryCount: 0,
    nextRetryAt: null,
    deadLetteredAt: null,
    createdAt: new Date(),
    processedAt: null,
    ...overrides,
  };
}

function createMocks() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const prisma: any = {
    $queryRaw: vi.fn(),
    outboxMessage: {
      update: vi.fn().mockResolvedValue({}),
    },
  };

  const mailSender = {
    sendVerificationEmail: vi.fn().mockResolvedValue(undefined),
    sendPasswordResetEmail: vi.fn().mockResolvedValue(undefined),
  };

  // kafkaClient.emit() returns an Observable — use rxjs `of()` for success
  const kafkaClient = {
    connect: vi.fn().mockResolvedValue(undefined),
    emit: vi.fn().mockReturnValue(of(undefined)),
  };

  const authCommandHandler = new AuthInternalCommandHandler(mailSender as never);

  const processor = new OutboxProcessor(
    prisma,
    kafkaClient as never,
    [authCommandHandler],
  );

  return { processor, prisma, mailSender, kafkaClient, authCommandHandler };
}

// ─── OutboxProcessor Tests ────────────────────────────────────────────────────

describe('OutboxProcessor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('processOutboxMessages()', () => {
    it('does nothing when there are no PENDING messages', async () => {
      const { processor, prisma, kafkaClient } = createMocks();
      prisma.$queryRaw.mockResolvedValue([]);

      await processor.processOutboxMessages();

      expect(kafkaClient.emit).not.toHaveBeenCalled();
      expect(prisma.outboxMessage.update).not.toHaveBeenCalled();
    });

    it('emits INTEGRATION_EVENT to Kafka with correct topic and payload', async () => {
      const { processor, prisma, kafkaClient } = createMocks();
      const msg = buildOutboxMessage({ topic: 'NoteShared', type: 'INTEGRATION_EVENT' });
      prisma.$queryRaw.mockResolvedValue([msg]);

      await processor.processOutboxMessages();

      expect(kafkaClient.emit).toHaveBeenCalledTimes(1);
      const [topic, payload] = kafkaClient.emit.mock.calls[0]!;
      expect(topic).toBe('NoteShared');
      expect(payload).toMatchObject({ noteId: 'note-1', recipientId: 'user-2' });
    });

    it('marks message as PROCESSED after successful Kafka emit', async () => {
      const { processor, prisma } = createMocks();
      const msg = buildOutboxMessage();
      prisma.$queryRaw.mockResolvedValue([msg]);

      await processor.processOutboxMessages();

      expect(prisma.outboxMessage.update).toHaveBeenCalledWith({
        where: { id: 'msg-1' },
        data: expect.objectContaining({ status: 'PROCESSED', processedAt: expect.any(Date) }),
      });
    });

    it('schedules a retry (PENDING + backoff) on first failure instead of permanently failing', async () => {
      const { processor, prisma, kafkaClient } = createMocks();
      const msg = buildOutboxMessage({ retryCount: 0 });
      prisma.$queryRaw.mockResolvedValue([msg]);
      // Kafka emit returns an Observable that errors
      kafkaClient.emit.mockReturnValue(throwError(() => new Error('Kafka unavailable')));

      await processor.processOutboxMessages();

      // Should NOT be marked FAILED — should be re-scheduled as PENDING
      expect(prisma.outboxMessage.update).toHaveBeenCalledWith({
        where: { id: 'msg-1' },
        data: expect.objectContaining({
          status: 'PENDING',
          retryCount: 1,
          nextRetryAt: expect.any(Date),
        }),
      });
    });

    it('moves message to DEAD_LETTERED after MAX_RETRIES failures', async () => {
      const { processor, prisma, kafkaClient } = createMocks();
      // retryCount: 4 means this is the 5th attempt → should dead-letter
      const msg = buildOutboxMessage({ retryCount: 4 });
      prisma.$queryRaw.mockResolvedValue([msg]);
      kafkaClient.emit.mockReturnValue(throwError(() => new Error('timeout')));

      await processor.processOutboxMessages();

      expect(prisma.outboxMessage.update).toHaveBeenCalledWith({
        where: { id: 'msg-1' },
        data: expect.objectContaining({
          status: 'DEAD_LETTERED',
          retryCount: 5,
          deadLetteredAt: expect.any(Date),
        }),
      });
    });

    it('delegates INTERNAL_COMMAND — SendVerificationEmail to AuthInternalCommandHandler', async () => {
      const { processor, prisma, mailSender } = createMocks();
      const msg = buildOutboxMessage({
        type: 'INTERNAL_COMMAND',
        topic: 'SendVerificationEmail',
        payload: JSON.stringify({
          email: 'user@test.com',
          displayName: 'User',
          verificationToken: 'tok-123',
        }),
      });
      prisma.$queryRaw.mockResolvedValue([msg]);

      await processor.processOutboxMessages();

      expect(mailSender.sendVerificationEmail).toHaveBeenCalledWith(
        'user@test.com',
        'User',
        'tok-123',
      );
    });

    it('delegates INTERNAL_COMMAND — SendPasswordResetEmail to AuthInternalCommandHandler', async () => {
      const { processor, prisma, mailSender } = createMocks();
      const msg = buildOutboxMessage({
        type: 'INTERNAL_COMMAND',
        topic: 'SendPasswordResetEmail',
        payload: JSON.stringify({ email: 'user@test.com', resetToken: 'reset-tok' }),
      });
      prisma.$queryRaw.mockResolvedValue([msg]);

      await processor.processOutboxMessages();

      expect(mailSender.sendPasswordResetEmail).toHaveBeenCalledWith('user@test.com', 'reset-tok');
    });

    it('marks INTERNAL_COMMAND as PROCESSED on success', async () => {
      const { processor, prisma } = createMocks();
      const msg = buildOutboxMessage({
        type: 'INTERNAL_COMMAND',
        topic: 'SendVerificationEmail',
        payload: JSON.stringify({ email: 'x@test.com', displayName: 'X', verificationToken: 'tok' }),
      });
      prisma.$queryRaw.mockResolvedValue([msg]);

      await processor.processOutboxMessages();

      expect(prisma.outboxMessage.update).toHaveBeenCalledWith({
        where: { id: 'msg-1' },
        data: expect.objectContaining({ status: 'PROCESSED' }),
      });
    });

    it('processes multiple messages in a single poll', async () => {
      const { processor, prisma, kafkaClient } = createMocks();
      const messages = [
        buildOutboxMessage({ id: 'msg-1', topic: 'NoteShared' }),
        buildOutboxMessage({ id: 'msg-2', topic: 'NoteShared', payload: JSON.stringify({ noteId: 'note-2' }) }),
      ];
      prisma.$queryRaw.mockResolvedValue(messages);

      await processor.processOutboxMessages();

      expect(kafkaClient.emit).toHaveBeenCalledTimes(2);
      expect(prisma.outboxMessage.update).toHaveBeenCalledTimes(2);
    });

    it('continues processing remaining messages when one fails', async () => {
      const { processor, prisma, kafkaClient } = createMocks();
      const messages = [
        buildOutboxMessage({ id: 'msg-fail', topic: 'NoteShared', retryCount: 0 }),
        buildOutboxMessage({ id: 'msg-ok', topic: 'NoteShared', payload: JSON.stringify({ noteId: 'note-2' }) }),
      ];
      prisma.$queryRaw.mockResolvedValue(messages);
      kafkaClient.emit
        .mockReturnValueOnce(throwError(() => new Error('timeout')))
        .mockReturnValueOnce(of(undefined));

      await processor.processOutboxMessages();

      // First message: retry scheduled
      expect(prisma.outboxMessage.update).toHaveBeenCalledWith({
        where: { id: 'msg-fail' },
        data: expect.objectContaining({ status: 'PENDING', retryCount: 1 }),
      });
      // Second message: success
      expect(prisma.outboxMessage.update).toHaveBeenCalledWith({
        where: { id: 'msg-ok' },
        data: expect.objectContaining({ status: 'PROCESSED' }),
      });
    });
  });
});
