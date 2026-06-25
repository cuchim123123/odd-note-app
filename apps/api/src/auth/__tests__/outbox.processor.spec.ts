import { beforeEach, describe, expect, it, vi } from 'vitest';
import { OutboxProcessor } from '../infrastructure/scheduling/outbox.processor';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function buildOutboxMessage(overrides: Partial<{
  id: string;
  type: string;
  topic: string;
  payload: string;
  status: string;
  createdAt: Date;
  processedAt: Date | null;
}> = {}) {
  return {
    id: 'msg-1',
    type: 'INTEGRATION_EVENT',
    topic: 'NoteShared',
    payload: JSON.stringify({ noteId: 'note-1', recipientId: 'user-2' }),
    status: 'PENDING',
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

  const kafkaClient = {
    connect: vi.fn().mockResolvedValue(undefined),
    emit: vi.fn(),
  };

  const processor = new OutboxProcessor(
    prisma,
    mailSender as never,
    kafkaClient as never,
  );

  return { processor, prisma, mailSender, kafkaClient };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

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
      const { processor, prisma, kafkaClient } = createMocks();
      const msg = buildOutboxMessage();
      prisma.$queryRaw.mockResolvedValue([msg]);
      kafkaClient.emit.mockReturnValue(undefined);

      await processor.processOutboxMessages();

      expect(prisma.outboxMessage.update).toHaveBeenCalledWith({
        where: { id: 'msg-1' },
        data: expect.objectContaining({ status: 'PROCESSED', processedAt: expect.any(Date) }),
      });
    });

    it('marks message as FAILED when processing throws', async () => {
      const { processor, prisma, kafkaClient } = createMocks();
      const msg = buildOutboxMessage();
      prisma.$queryRaw.mockResolvedValue([msg]);
      kafkaClient.emit.mockImplementation(() => { throw new Error('Kafka unavailable'); });

      await processor.processOutboxMessages();

      expect(prisma.outboxMessage.update).toHaveBeenCalledWith({
        where: { id: 'msg-1' },
        data: { status: 'FAILED' },
      });
    });

    it('processes INTERNAL_COMMAND — SendVerificationEmail calls mailSender', async () => {
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

    it('processes INTERNAL_COMMAND — SendPasswordResetEmail calls mailSender', async () => {
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

    it('marks message as PROCESSED even for INTERNAL_COMMAND on success', async () => {
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

    it('processes multiple messages in a single poll, marking each PROCESSED', async () => {
      const { processor, prisma, kafkaClient } = createMocks();
      const messages = [
        buildOutboxMessage({ id: 'msg-1', topic: 'NoteShared' }),
        buildOutboxMessage({ id: 'msg-2', topic: 'NoteShared', payload: JSON.stringify({ noteId: 'note-2' }) }),
      ];
      prisma.$queryRaw.mockResolvedValue(messages);
      kafkaClient.emit.mockReturnValue(undefined);

      await processor.processOutboxMessages();

      expect(kafkaClient.emit).toHaveBeenCalledTimes(2);
      expect(prisma.outboxMessage.update).toHaveBeenCalledTimes(2);
      expect(prisma.outboxMessage.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'msg-1' } }),
      );
      expect(prisma.outboxMessage.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'msg-2' } }),
      );
    });

    it('continues processing remaining messages when one fails', async () => {
      const { processor, prisma, kafkaClient } = createMocks();
      const messages = [
        buildOutboxMessage({ id: 'msg-fail', topic: 'NoteShared' }),
        buildOutboxMessage({ id: 'msg-ok', topic: 'NoteShared', payload: JSON.stringify({ noteId: 'note-2' }) }),
      ];
      prisma.$queryRaw.mockResolvedValue(messages);
      kafkaClient.emit
        .mockImplementationOnce(() => { throw new Error('timeout'); })
        .mockReturnValueOnce(undefined);

      await processor.processOutboxMessages();

      // First fails, second succeeds
      expect(prisma.outboxMessage.update).toHaveBeenCalledWith({
        where: { id: 'msg-fail' },
        data: { status: 'FAILED' },
      });
      expect(prisma.outboxMessage.update).toHaveBeenCalledWith({
        where: { id: 'msg-ok' },
        data: expect.objectContaining({ status: 'PROCESSED' }),
      });
    });
  });
});
