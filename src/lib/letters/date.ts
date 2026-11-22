const CAIRO_TIME_ZONE = 'Africa/Cairo';

export function dateKeyInTimeZone(date: Date, timeZone: string): string {
  let parts: Intl.DateTimeFormatPart[];
  try {
    parts = new Intl.DateTimeFormat('en-CA', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      timeZone,
    }).formatToParts(date);
  } catch {
    parts = new Intl.DateTimeFormat('en-CA', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      timeZone: CAIRO_TIME_ZONE,
    }).formatToParts(date);
  }

  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? '';
  return `${value('year')}-${value('month')}-${value('day')}`;
}

export function addDaysToDateKey(dateKey: string, days: number): string {
  const [year, month, day] = dateKey.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

export function addMonthsToDateKey(dateKey: string, months: number): string {
  const [year, month, day] = dateKey.split('-').map(Number);
  const firstOfTargetMonth = new Date(Date.UTC(year, month - 1 + months, 1));
  const targetYear = firstOfTargetMonth.getUTCFullYear();
  const targetMonth = firstOfTargetMonth.getUTCMonth();
  const lastDay = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();
  const targetDay = Math.min(day, lastDay);
  return new Date(Date.UTC(targetYear, targetMonth, targetDay)).toISOString().slice(0, 10);
}

export function isDateKey(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function letterDateLimits(today: string) {
  return {
    minDate: addDaysToDateKey(today, 1),
    maxDate: addMonthsToDateKey(today, 120),
  };
}
