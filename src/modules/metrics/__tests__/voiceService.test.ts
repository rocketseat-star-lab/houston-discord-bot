import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../utils/retry', () => ({
  withRetry: vi.fn((fn: () => Promise<unknown>) => fn()),
}));

vi.mock('../../../services/prisma', () => ({
  default: {
    metricsActiveVoiceSession: {
      upsert: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      delete: vi.fn(),
      create: vi.fn(),
    },
    metricsCompletedVoiceSession: {
      create: vi.fn(),
    },
    metricsVoiceEvent: {
      create: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

import prisma from '../../../services/prisma';
import {
  startVoiceSession,
  endVoiceSession,
  moveVoiceChannel,
  recordVoiceEvent,
  cleanupOrphanedSessions,
} from '../services/voiceService';

const mockedPrisma = vi.mocked(prisma, true);

describe('voiceService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'log').mockImplementation(() => {});

    // Default $transaction implementation: execute callback with prisma itself
    mockedPrisma.$transaction.mockImplementation(async (fn: any) => fn(mockedPrisma));
  });

  describe('startVoiceSession', () => {
    it('should call upsert with correct guild, user, session, and channel data', async () => {
      mockedPrisma.metricsActiveVoiceSession.upsert.mockResolvedValue({} as any);

      await startVoiceSession('guild-1', 'user-1', 'session-1', 'channel-1');

      expect(mockedPrisma.metricsActiveVoiceSession.upsert).toHaveBeenCalledWith({
        where: {
          guildId_userId_discordSessionId: {
            guildId: 'guild-1',
            userId: 'user-1',
            discordSessionId: 'session-1',
          },
        },
        create: expect.objectContaining({
          guildId: 'guild-1',
          userId: 'user-1',
          discordSessionId: 'session-1',
          channelId: 'channel-1',
        }),
        update: expect.objectContaining({
          channelId: 'channel-1',
        }),
      });
    });

    it('should set joinTimestamp in both create and update', async () => {
      mockedPrisma.metricsActiveVoiceSession.upsert.mockResolvedValue({} as any);

      const before = new Date();
      await startVoiceSession('g', 'u', 's', 'c');
      const after = new Date();

      const call = mockedPrisma.metricsActiveVoiceSession.upsert.mock.calls[0][0];
      const createTimestamp = call.create.joinTimestamp as Date;
      const updateTimestamp = call.update.joinTimestamp as Date;

      expect(createTimestamp.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(createTimestamp.getTime()).toBeLessThanOrEqual(after.getTime());
      expect(updateTimestamp.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(updateTimestamp.getTime()).toBeLessThanOrEqual(after.getTime());
    });
  });

  describe('endVoiceSession', () => {
    it('should find the session, delete it, and create a completed session', async () => {
      const joinTimestamp = new Date(Date.now() - 60000); // 60 seconds ago
      mockedPrisma.metricsActiveVoiceSession.findUnique.mockResolvedValue({
        guildId: 'guild-1',
        userId: 'user-1',
        discordSessionId: 'session-1',
        channelId: 'channel-1',
        joinTimestamp,
      } as any);
      mockedPrisma.metricsActiveVoiceSession.delete.mockResolvedValue({} as any);
      mockedPrisma.metricsCompletedVoiceSession.create.mockResolvedValue({} as any);

      const result = await endVoiceSession('guild-1', 'user-1', 'session-1');

      expect(result).not.toBeNull();
      expect(result!.channelId).toBe('channel-1');
      expect(result!.durationSeconds).toBeGreaterThanOrEqual(59);
      expect(result!.durationSeconds).toBeLessThanOrEqual(61);

      expect(mockedPrisma.metricsActiveVoiceSession.findUnique).toHaveBeenCalledWith({
        where: {
          guildId_userId_discordSessionId: {
            guildId: 'guild-1',
            userId: 'user-1',
            discordSessionId: 'session-1',
          },
        },
      });

      expect(mockedPrisma.metricsActiveVoiceSession.delete).toHaveBeenCalled();
      expect(mockedPrisma.metricsCompletedVoiceSession.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          guildId: 'guild-1',
          userId: 'user-1',
          channelId: 'channel-1',
          discordSessionId: 'session-1',
          joinTimestamp,
        }),
      });
    });

    it('should return null when no active session is found', async () => {
      mockedPrisma.metricsActiveVoiceSession.findUnique.mockResolvedValue(null);

      const result = await endVoiceSession('guild-1', 'user-1', 'session-1');

      expect(result).toBeNull();
      expect(mockedPrisma.metricsActiveVoiceSession.delete).not.toHaveBeenCalled();
      expect(mockedPrisma.metricsCompletedVoiceSession.create).not.toHaveBeenCalled();
    });

    it('should prevent negative duration using Math.max(0, ...)', async () => {
      // joinTimestamp in the future (simulates clock skew)
      const futureTimestamp = new Date(Date.now() + 60000);
      mockedPrisma.metricsActiveVoiceSession.findUnique.mockResolvedValue({
        guildId: 'g',
        userId: 'u',
        discordSessionId: 's',
        channelId: 'c',
        joinTimestamp: futureTimestamp,
      } as any);
      mockedPrisma.metricsActiveVoiceSession.delete.mockResolvedValue({} as any);
      mockedPrisma.metricsCompletedVoiceSession.create.mockResolvedValue({} as any);

      const result = await endVoiceSession('g', 'u', 's');

      expect(result).not.toBeNull();
      expect(result!.durationSeconds).toBe(0);

      const createCall = mockedPrisma.metricsCompletedVoiceSession.create.mock.calls[0][0];
      expect(createCall.data.durationSeconds).toBe(0);
    });

    it('should run inside a $transaction', async () => {
      mockedPrisma.metricsActiveVoiceSession.findUnique.mockResolvedValue(null);

      await endVoiceSession('g', 'u', 's');

      expect(mockedPrisma.$transaction).toHaveBeenCalledWith(expect.any(Function));
    });
  });

  describe('moveVoiceChannel', () => {
    it('should end old session and start a new one when session exists', async () => {
      const joinTimestamp = new Date(Date.now() - 30000);
      mockedPrisma.metricsActiveVoiceSession.findUnique.mockResolvedValue({
        guildId: 'guild-1',
        userId: 'user-1',
        discordSessionId: 'session-1',
        channelId: 'old-channel',
        joinTimestamp,
      } as any);
      mockedPrisma.metricsActiveVoiceSession.delete.mockResolvedValue({} as any);
      mockedPrisma.metricsCompletedVoiceSession.create.mockResolvedValue({} as any);
      mockedPrisma.metricsActiveVoiceSession.create.mockResolvedValue({} as any);

      await moveVoiceChannel('guild-1', 'user-1', 'session-1', 'new-channel');

      // Should delete old session
      expect(mockedPrisma.metricsActiveVoiceSession.delete).toHaveBeenCalled();

      // Should create completed session for old channel
      expect(mockedPrisma.metricsCompletedVoiceSession.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          channelId: 'old-channel',
        }),
      });

      // Should create new active session for new channel
      expect(mockedPrisma.metricsActiveVoiceSession.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          guildId: 'guild-1',
          userId: 'user-1',
          discordSessionId: 'session-1',
          channelId: 'new-channel',
        }),
      });
    });

    it('should create new session even when no old session exists', async () => {
      mockedPrisma.metricsActiveVoiceSession.findUnique.mockResolvedValue(null);
      mockedPrisma.metricsActiveVoiceSession.create.mockResolvedValue({} as any);

      await moveVoiceChannel('guild-1', 'user-1', 'session-1', 'new-channel');

      // Should not try to delete or create completed session
      expect(mockedPrisma.metricsActiveVoiceSession.delete).not.toHaveBeenCalled();
      expect(mockedPrisma.metricsCompletedVoiceSession.create).not.toHaveBeenCalled();

      // Should still create new active session
      expect(mockedPrisma.metricsActiveVoiceSession.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          channelId: 'new-channel',
        }),
      });
    });

    it('should run inside a $transaction', async () => {
      mockedPrisma.metricsActiveVoiceSession.findUnique.mockResolvedValue(null);
      mockedPrisma.metricsActiveVoiceSession.create.mockResolvedValue({} as any);

      await moveVoiceChannel('g', 'u', 's', 'c');

      expect(mockedPrisma.$transaction).toHaveBeenCalledWith(expect.any(Function));
    });
  });

  describe('recordVoiceEvent', () => {
    it('should create a voice event with all provided data', async () => {
      mockedPrisma.metricsVoiceEvent.create.mockResolvedValue({} as any);

      await recordVoiceEvent({
        guildId: 'guild-1',
        userId: 'user-1',
        channelId: 'channel-1',
        channelName: 'General',
        eventType: 'join',
        sessionId: 'session-1',
      });

      expect(mockedPrisma.metricsVoiceEvent.create).toHaveBeenCalledWith({
        data: {
          guildId: 'guild-1',
          userId: 'user-1',
          channelId: 'channel-1',
          channelName: 'General',
          eventType: 'join',
          sessionId: 'session-1',
        },
      });
    });

    it('should default optional fields to null', async () => {
      mockedPrisma.metricsVoiceEvent.create.mockResolvedValue({} as any);

      await recordVoiceEvent({
        guildId: 'guild-1',
        userId: 'user-1',
        eventType: 'leave',
      });

      expect(mockedPrisma.metricsVoiceEvent.create).toHaveBeenCalledWith({
        data: {
          guildId: 'guild-1',
          userId: 'user-1',
          channelId: null,
          channelName: null,
          eventType: 'leave',
          sessionId: null,
        },
      });
    });
  });

  describe('cleanupOrphanedSessions', () => {
    it('should return 0 when there are no active sessions', async () => {
      mockedPrisma.metricsActiveVoiceSession.findMany.mockResolvedValue([]);

      const result = await cleanupOrphanedSessions();

      expect(result).toBe(0);
      expect(mockedPrisma.$transaction).not.toHaveBeenCalled();
    });

    it('should process all active sessions and return count', async () => {
      const sessions = [
        {
          guildId: 'g1',
          userId: 'u1',
          discordSessionId: 's1',
          channelId: 'c1',
          joinTimestamp: new Date(Date.now() - 3600000),
        },
        {
          guildId: 'g1',
          userId: 'u2',
          discordSessionId: 's2',
          channelId: 'c2',
          joinTimestamp: new Date(Date.now() - 1800000),
        },
      ];

      mockedPrisma.metricsActiveVoiceSession.findMany.mockResolvedValue(sessions as any);
      mockedPrisma.metricsActiveVoiceSession.delete.mockResolvedValue({} as any);
      mockedPrisma.metricsCompletedVoiceSession.create.mockResolvedValue({} as any);

      const result = await cleanupOrphanedSessions();

      expect(result).toBe(2);
      expect(mockedPrisma.$transaction).toHaveBeenCalledTimes(2);
      expect(mockedPrisma.metricsActiveVoiceSession.delete).toHaveBeenCalledTimes(2);
      expect(mockedPrisma.metricsCompletedVoiceSession.create).toHaveBeenCalledTimes(2);
    });

    it('should calculate duration correctly for each orphaned session', async () => {
      const joinTimestamp = new Date(Date.now() - 120000); // 2 minutes ago
      const sessions = [
        {
          guildId: 'g1',
          userId: 'u1',
          discordSessionId: 's1',
          channelId: 'c1',
          joinTimestamp,
        },
      ];

      mockedPrisma.metricsActiveVoiceSession.findMany.mockResolvedValue(sessions as any);
      mockedPrisma.metricsActiveVoiceSession.delete.mockResolvedValue({} as any);
      mockedPrisma.metricsCompletedVoiceSession.create.mockResolvedValue({} as any);

      await cleanupOrphanedSessions();

      const createCall = mockedPrisma.metricsCompletedVoiceSession.create.mock.calls[0][0];
      const duration = createCall.data.durationSeconds;

      // Should be approximately 120 seconds
      expect(duration).toBeGreaterThanOrEqual(119);
      expect(duration).toBeLessThanOrEqual(121);
    });
  });
});
