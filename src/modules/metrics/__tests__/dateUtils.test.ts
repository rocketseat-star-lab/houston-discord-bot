import { describe, it, expect } from 'vitest';
import {
  getStartOfDayUTC,
  getEndOfDayUTC,
  getStartOfWeekUTC,
  getEndOfWeekUTC,
  getStartOfMonthUTC,
  getEndOfMonthUTC,
  getYesterdayInTimezone,
  formatDateInTimezone,
} from '../utils/dateUtils';

const SP_TZ = 'America/Sao_Paulo';

describe('dateUtils', () => {
  describe('getStartOfDayUTC', () => {
    it('should return 03:00 UTC for a date in America/Sao_Paulo (UTC-3)', () => {
      // 2026-03-15 at noon UTC => in SP it is 09:00
      // Start of day in SP = 00:00 SP = 03:00 UTC
      const date = new Date('2026-03-15T12:00:00Z');
      const result = getStartOfDayUTC(date, SP_TZ);

      expect(result.toISOString()).toBe('2026-03-15T03:00:00.000Z');
    });

    it('should handle dates near midnight UTC correctly', () => {
      // 2026-03-15 at 01:00 UTC => in SP it is 22:00 on March 14
      // Start of day in SP for March 14 = 00:00 SP = 03:00 UTC on March 14
      const date = new Date('2026-03-15T01:00:00Z');
      const result = getStartOfDayUTC(date, SP_TZ);

      expect(result.toISOString()).toBe('2026-03-14T03:00:00.000Z');
    });

    it('should handle Jan 1 crossing to previous year in SP timezone', () => {
      // 2026-01-01 at 02:00 UTC => in SP it is 23:00 on Dec 31, 2025
      // Start of day for Dec 31, 2025 in SP = 03:00 UTC Dec 31, 2025
      const date = new Date('2026-01-01T02:00:00Z');
      const result = getStartOfDayUTC(date, SP_TZ);

      expect(result.toISOString()).toBe('2025-12-31T03:00:00.000Z');
    });

    it('should handle leap year Feb 29', () => {
      const date = new Date('2028-02-29T12:00:00Z');
      const result = getStartOfDayUTC(date, SP_TZ);

      expect(result.toISOString()).toBe('2028-02-29T03:00:00.000Z');
    });

    it('should work with UTC timezone (offset 0)', () => {
      const date = new Date('2026-06-15T15:30:00Z');
      const result = getStartOfDayUTC(date, 'UTC');

      expect(result.toISOString()).toBe('2026-06-15T00:00:00.000Z');
    });
  });

  describe('getEndOfDayUTC', () => {
    it('should return start of next day in UTC for SP timezone', () => {
      // End of day for March 15 in SP = start of March 16 SP = 03:00 UTC March 16
      const date = new Date('2026-03-15T12:00:00Z');
      const result = getEndOfDayUTC(date, SP_TZ);

      expect(result.toISOString()).toBe('2026-03-16T03:00:00.000Z');
    });

    it('should handle month boundary (last day of month)', () => {
      // March 31 in SP: end of day = start of April 1 SP = 03:00 UTC April 1
      const date = new Date('2026-03-31T12:00:00Z');
      const result = getEndOfDayUTC(date, SP_TZ);

      expect(result.toISOString()).toBe('2026-04-01T03:00:00.000Z');
    });

    it('should handle Dec 31 crossing to next year', () => {
      const date = new Date('2025-12-31T12:00:00Z');
      const result = getEndOfDayUTC(date, SP_TZ);

      expect(result.toISOString()).toBe('2026-01-01T03:00:00.000Z');
    });

    it('should handle leap year Feb 28 -> Feb 29', () => {
      const date = new Date('2028-02-28T12:00:00Z');
      const result = getEndOfDayUTC(date, SP_TZ);

      expect(result.toISOString()).toBe('2028-02-29T03:00:00.000Z');
    });

    it('should handle non-leap year Feb 28 -> Mar 1', () => {
      const date = new Date('2026-02-28T12:00:00Z');
      const result = getEndOfDayUTC(date, SP_TZ);

      expect(result.toISOString()).toBe('2026-03-01T03:00:00.000Z');
    });
  });

  describe('getStartOfWeekUTC', () => {
    it('should return Monday as start of week', () => {
      // 2026-03-15 is a Sunday in SP timezone
      // The Monday before is March 9
      // Start of March 9 in SP = 03:00 UTC March 9
      const date = new Date('2026-03-15T12:00:00Z');
      const result = getStartOfWeekUTC(date, SP_TZ);

      expect(result.toISOString()).toBe('2026-03-09T03:00:00.000Z');
    });

    it('should return same day when date is Monday', () => {
      // 2026-03-09 is a Monday
      const date = new Date('2026-03-09T12:00:00Z');
      const result = getStartOfWeekUTC(date, SP_TZ);

      expect(result.toISOString()).toBe('2026-03-09T03:00:00.000Z');
    });

    it('should handle week crossing month boundary', () => {
      // 2026-03-01 is a Sunday => week started on Feb 23 (Monday)
      const date = new Date('2026-03-01T12:00:00Z');
      const result = getStartOfWeekUTC(date, SP_TZ);

      expect(result.toISOString()).toBe('2026-02-23T03:00:00.000Z');
    });
  });

  describe('getEndOfWeekUTC', () => {
    it('should return end of Sunday as end of week', () => {
      // 2026-03-09 is a Monday
      // End of week (Sunday) = March 15
      const date = new Date('2026-03-09T12:00:00Z');
      const result = getEndOfWeekUTC(date, SP_TZ);

      // endOfWeek returns the last moment of Sunday (23:59:59.999 SP)
      // = March 16 02:59:59.999 UTC
      expect(result.getUTCFullYear()).toBe(2026);
      expect(result.getUTCMonth()).toBe(2); // March
      expect(result.getUTCDate()).toBe(16);
    });
  });

  describe('getStartOfMonthUTC', () => {
    it('should return first day of month in UTC', () => {
      const date = new Date('2026-03-15T12:00:00Z');
      const result = getStartOfMonthUTC(date, SP_TZ);

      expect(result.toISOString()).toBe('2026-03-01T03:00:00.000Z');
    });

    it('should handle first day of year', () => {
      const date = new Date('2026-01-15T12:00:00Z');
      const result = getStartOfMonthUTC(date, SP_TZ);

      expect(result.toISOString()).toBe('2026-01-01T03:00:00.000Z');
    });

    it('should handle date near month boundary in SP timezone', () => {
      // 2026-04-01 at 02:00 UTC => in SP it is 23:00 on March 31
      // Start of month for March in SP = March 1 03:00 UTC
      const date = new Date('2026-04-01T02:00:00Z');
      const result = getStartOfMonthUTC(date, SP_TZ);

      expect(result.toISOString()).toBe('2026-03-01T03:00:00.000Z');
    });
  });

  describe('getEndOfMonthUTC', () => {
    it('should return end of last day of month', () => {
      const date = new Date('2026-03-15T12:00:00Z');
      const result = getEndOfMonthUTC(date, SP_TZ);

      // End of March 31 in SP = 23:59:59.999 SP = next day ~02:59 UTC
      expect(result.getUTCFullYear()).toBe(2026);
      expect(result.getUTCMonth()).toBe(3); // April
      expect(result.getUTCDate()).toBe(1);
    });

    it('should handle February in leap year', () => {
      const date = new Date('2028-02-15T12:00:00Z');
      const result = getEndOfMonthUTC(date, SP_TZ);

      // End of Feb 29 in SP
      expect(result.getUTCMonth()).toBe(2); // March
      expect(result.getUTCDate()).toBe(1);
    });

    it('should handle February in non-leap year', () => {
      const date = new Date('2026-02-15T12:00:00Z');
      const result = getEndOfMonthUTC(date, SP_TZ);

      // End of Feb 28 in SP
      expect(result.getUTCMonth()).toBe(2); // March
      expect(result.getUTCDate()).toBe(1);
    });
  });

  describe('getYesterdayInTimezone', () => {
    it('should return a date that is one day before now in SP timezone', () => {
      const result = getYesterdayInTimezone(SP_TZ);
      const now = new Date();

      // The result should be approximately 24 hours before now
      const diffMs = now.getTime() - result.getTime();
      const diffHours = diffMs / (1000 * 60 * 60);

      // Should be roughly 24 hours (allow some margin for timezone conversion)
      expect(diffHours).toBeGreaterThan(20);
      expect(diffHours).toBeLessThan(28);
    });
  });

  describe('formatDateInTimezone', () => {
    it('should format date correctly in SP timezone', () => {
      // 2026-03-15 at 12:00 UTC => 09:00 SP
      const date = new Date('2026-03-15T12:00:00Z');
      const result = formatDateInTimezone(date, 'dd/MM/yyyy', SP_TZ);

      expect(result).toBe('15/03/2026');
    });

    it('should format time correctly in SP timezone', () => {
      const date = new Date('2026-03-15T15:30:00Z');
      const result = formatDateInTimezone(date, 'HH:mm', SP_TZ);

      expect(result).toBe('12:30');
    });

    it('should handle date that crosses day boundary in timezone', () => {
      // 2026-03-16 at 02:00 UTC => March 15 at 23:00 in SP
      const date = new Date('2026-03-16T02:00:00Z');
      const result = formatDateInTimezone(date, 'dd/MM/yyyy', SP_TZ);

      expect(result).toBe('15/03/2026');
    });

    it('should support different format patterns', () => {
      const date = new Date('2026-03-15T12:00:00Z');
      const result = formatDateInTimezone(date, 'yyyy-MM-dd', SP_TZ);

      expect(result).toBe('2026-03-15');
    });
  });
});
