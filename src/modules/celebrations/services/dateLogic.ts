import Holidays from 'date-holidays';

const hd = new Holidays('BR');

function isHoliday(date: Date): boolean {
  const result = hd.isHoliday(date) as Array<{ type: string }> | false;
  if (!result || !Array.isArray(result)) return false;
  return result.some((h) => h.type === 'public');
}

function isWeekend(date: Date): boolean {
  const d = date.getDay();
  return d === 0 || d === 6;
}

function isOffDay(date: Date): boolean {
  return isWeekend(date) || isHoliday(date);
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

/**
 * Returns the list of dates that should be celebrated today.
 *
 * Behavior:
 * - If today is an off day (weekend or holiday) -> returns empty (no run).
 * - Otherwise returns [today, ...next consecutive off days until next workday].
 *   This way, Friday + holiday Monday means: on Friday we anticipate
 *   Saturday, Sunday and Monday.
 */
export function getDatesToCover(today: Date = new Date()): Date[] {
  const start = new Date(today);
  start.setHours(0, 0, 0, 0);

  if (isOffDay(start)) return [];

  const dates = [start];
  let next = addDays(start, 1);
  while (isOffDay(next)) {
    dates.push(next);
    next = addDays(next, 1);
  }
  return dates;
}

export function dayOfDate(d: Date): string {
  return String(d.getDate()).padStart(2, '0');
}

const PT_MONTH_ABBR = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
export function monthAbbrOfDate(d: Date): string {
  return PT_MONTH_ABBR[d.getMonth()];
}

export function yearsOnCompany(admissionDate: Date | string, today: Date = new Date()): number {
  const a = typeof admissionDate === 'string' ? new Date(admissionDate) : admissionDate;
  return today.getFullYear() - a.getFullYear();
}

export function formatBR(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}
