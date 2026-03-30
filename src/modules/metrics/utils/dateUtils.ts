import {
  startOfDay,
  endOfDay,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  subDays,
  subWeeks,
  subMonths,
  format,
} from 'date-fns';
import { toZonedTime, fromZonedTime } from 'date-fns-tz';

export function getStartOfDayUTC(date: Date, timezone: string): Date {
  const zonedDate = toZonedTime(date, timezone);
  const startOfDayInTz = startOfDay(zonedDate);
  return fromZonedTime(startOfDayInTz, timezone);
}

export function getEndOfDayUTC(date: Date, timezone: string): Date {
  const zonedDate = toZonedTime(date, timezone);
  const startOfNextDay = startOfDay(zonedDate);
  startOfNextDay.setDate(startOfNextDay.getDate() + 1);
  return fromZonedTime(startOfNextDay, timezone);
}

export function getStartOfWeekUTC(date: Date, timezone: string): Date {
  const zonedDate = toZonedTime(date, timezone);
  const weekStart = startOfWeek(zonedDate, { weekStartsOn: 1 });
  return fromZonedTime(weekStart, timezone);
}

export function getEndOfWeekUTC(date: Date, timezone: string): Date {
  const zonedDate = toZonedTime(date, timezone);
  const weekEnd = endOfWeek(zonedDate, { weekStartsOn: 1 });
  return fromZonedTime(weekEnd, timezone);
}

export function getStartOfMonthUTC(date: Date, timezone: string): Date {
  const zonedDate = toZonedTime(date, timezone);
  const monthStart = startOfMonth(zonedDate);
  return fromZonedTime(monthStart, timezone);
}

export function getEndOfMonthUTC(date: Date, timezone: string): Date {
  const zonedDate = toZonedTime(date, timezone);
  const monthEnd = endOfMonth(zonedDate);
  return fromZonedTime(monthEnd, timezone);
}

export function getYesterdayInTimezone(timezone: string): Date {
  const now = new Date();
  const zonedNow = toZonedTime(now, timezone);
  return subDays(zonedNow, 1);
}

export function getLastWeekDateInTimezone(timezone: string): Date {
  const now = new Date();
  const zonedNow = toZonedTime(now, timezone);
  return subWeeks(zonedNow, 1);
}

export function getLastMonthDateInTimezone(timezone: string): Date {
  const now = new Date();
  const zonedNow = toZonedTime(now, timezone);
  return subMonths(zonedNow, 1);
}

export function formatDateInTimezone(
  date: Date,
  dateFormat: string,
  timezone: string
): string {
  const zonedDate = toZonedTime(date, timezone);
  return format(zonedDate, dateFormat);
}
