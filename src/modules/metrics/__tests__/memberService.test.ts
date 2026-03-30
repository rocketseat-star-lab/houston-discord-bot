import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../utils/retry', () => ({
  withRetry: vi.fn((fn: () => Promise<unknown>) => fn()),
}));

vi.mock('../../../services/prisma', () => ({
  default: {
    metricsMember: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    metricsJoinLeaveEvent: {
      create: vi.fn(),
    },
  },
}));

import prisma from '../../../services/prisma';
import {
  getDisplayName,
  ensureMemberExists,
  markMemberLeft,
  recordJoinEvent,
  recordLeaveEvent,
} from '../services/memberService';

const mockedPrisma = vi.mocked(prisma, true);

describe('memberService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getDisplayName', () => {
    it('should return "user#1234" for legacy discriminator', () => {
      expect(getDisplayName('user', '1234')).toBe('user#1234');
    });

    it('should return "user" for null discriminator', () => {
      expect(getDisplayName('user', null)).toBe('user');
    });

    it('should return "user" for undefined discriminator', () => {
      expect(getDisplayName('user')).toBe('user');
    });

    it('should return "user" for discriminator "0" (new username system)', () => {
      expect(getDisplayName('user', '0')).toBe('user');
    });

    it('should return "user#0001" for non-zero discriminator', () => {
      expect(getDisplayName('user', '0001')).toBe('user#0001');
    });

    it('should handle empty string discriminator as falsy', () => {
      expect(getDisplayName('user', '')).toBe('user');
    });
  });

  describe('ensureMemberExists', () => {
    it('should create a new member when none exists', async () => {
      mockedPrisma.metricsMember.findUnique.mockResolvedValue(null);
      mockedPrisma.metricsMember.create.mockResolvedValue({} as any);

      const joinDate = new Date('2026-03-15T12:00:00Z');
      await ensureMemberExists('guild-1', 'user-1', 'Alice', '0', false, joinDate, 'Ali');

      expect(mockedPrisma.metricsMember.findUnique).toHaveBeenCalledWith({
        where: { guildId_userId: { guildId: 'guild-1', userId: 'user-1' } },
        select: { isActive: true },
      });

      expect(mockedPrisma.metricsMember.create).toHaveBeenCalledWith({
        data: {
          guildId: 'guild-1',
          userId: 'user-1',
          username: 'Alice',
          discriminator: '0',
          isBot: false,
          joinedAt: joinDate,
          isActive: true,
          nickname: 'Ali',
        },
      });

      expect(mockedPrisma.metricsMember.update).not.toHaveBeenCalled();
    });

    it('should update existing active member without changing joinedAt', async () => {
      mockedPrisma.metricsMember.findUnique.mockResolvedValue({ isActive: true } as any);
      mockedPrisma.metricsMember.update.mockResolvedValue({} as any);

      await ensureMemberExists('guild-1', 'user-1', 'Alice', '1234', false, new Date(), null);

      expect(mockedPrisma.metricsMember.update).toHaveBeenCalledWith({
        where: { guildId_userId: { guildId: 'guild-1', userId: 'user-1' } },
        data: {
          username: 'Alice',
          discriminator: '1234',
          nickname: null,
          isActive: true,
        },
      });
    });

    it('should update inactive member and set new joinedAt', async () => {
      mockedPrisma.metricsMember.findUnique.mockResolvedValue({ isActive: false } as any);
      mockedPrisma.metricsMember.update.mockResolvedValue({} as any);

      const joinDate = new Date('2026-03-20T10:00:00Z');
      await ensureMemberExists('guild-1', 'user-1', 'Bob', null, false, joinDate, 'Bobby');

      expect(mockedPrisma.metricsMember.update).toHaveBeenCalledWith({
        where: { guildId_userId: { guildId: 'guild-1', userId: 'user-1' } },
        data: {
          username: 'Bob',
          discriminator: null,
          nickname: 'Bobby',
          isActive: true,
          joinedAt: joinDate,
        },
      });
    });

    it('should default optional fields when not provided', async () => {
      mockedPrisma.metricsMember.findUnique.mockResolvedValue(null);
      mockedPrisma.metricsMember.create.mockResolvedValue({} as any);

      await ensureMemberExists('guild-1', 'user-1', 'Charlie');

      const createCall = mockedPrisma.metricsMember.create.mock.calls[0][0];
      expect(createCall.data.discriminator).toBeNull();
      expect(createCall.data.isBot).toBe(false);
      expect(createCall.data.nickname).toBeNull();
      expect(createCall.data.joinedAt).toBeInstanceOf(Date);
    });

    it('should set isBot true for bot users', async () => {
      mockedPrisma.metricsMember.findUnique.mockResolvedValue(null);
      mockedPrisma.metricsMember.create.mockResolvedValue({} as any);

      await ensureMemberExists('guild-1', 'bot-1', 'BotUser', null, true);

      const createCall = mockedPrisma.metricsMember.create.mock.calls[0][0];
      expect(createCall.data.isBot).toBe(true);
    });
  });

  describe('markMemberLeft', () => {
    it('should call updateMany with isActive filter and set leftAt', async () => {
      mockedPrisma.metricsMember.updateMany.mockResolvedValue({ count: 1 } as any);

      const before = new Date();
      await markMemberLeft('guild-1', 'user-1');
      const after = new Date();

      expect(mockedPrisma.metricsMember.updateMany).toHaveBeenCalledWith({
        where: { guildId: 'guild-1', userId: 'user-1', isActive: true },
        data: {
          isActive: false,
          leftAt: expect.any(Date),
        },
      });

      const callData = mockedPrisma.metricsMember.updateMany.mock.calls[0][0].data;
      const leftAt = callData.leftAt as Date;
      expect(leftAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(leftAt.getTime()).toBeLessThanOrEqual(after.getTime());
    });

    it('should only update active members (isActive: true)', async () => {
      mockedPrisma.metricsMember.updateMany.mockResolvedValue({ count: 0 } as any);

      await markMemberLeft('guild-1', 'user-1');

      const where = mockedPrisma.metricsMember.updateMany.mock.calls[0]?.[0]?.where;
      expect(where?.isActive).toBe(true);
    });
  });

  describe('recordJoinEvent', () => {
    it('should create a join event with correct data', async () => {
      mockedPrisma.metricsJoinLeaveEvent.create.mockResolvedValue({} as any);

      await recordJoinEvent('guild-1', 'user-1');

      expect(mockedPrisma.metricsJoinLeaveEvent.create).toHaveBeenCalledWith({
        data: {
          guildId: 'guild-1',
          userId: 'user-1',
          eventType: 'join',
        },
      });
    });
  });

  describe('recordLeaveEvent', () => {
    it('should create a leave event with correct data', async () => {
      mockedPrisma.metricsJoinLeaveEvent.create.mockResolvedValue({} as any);

      await recordLeaveEvent('guild-1', 'user-1');

      expect(mockedPrisma.metricsJoinLeaveEvent.create).toHaveBeenCalledWith({
        data: {
          guildId: 'guild-1',
          userId: 'user-1',
          eventType: 'leave',
        },
      });
    });
  });
});
