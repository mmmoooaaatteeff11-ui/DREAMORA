import { CalculationMethod, Coordinates, PrayerTimes } from 'adhan';

export const CITIES = {
  cairo: { latitude: 30.0444, longitude: 31.2357, timeZone: 'Africa/Cairo' },
  alexandria: { latitude: 31.2001, longitude: 29.9187, timeZone: 'Africa/Cairo' },
  giza: { latitude: 29.987, longitude: 31.2118, timeZone: 'Africa/Cairo' },
  luxor: { latitude: 25.6872, longitude: 32.6396, timeZone: 'Africa/Cairo' },
  aswan: { latitude: 24.0889, longitude: 32.8998, timeZone: 'Africa/Cairo' },
  mansoura: { latitude: 31.0409, longitude: 31.3785, timeZone: 'Africa/Cairo' },
} as const;

export type CityId = keyof typeof CITIES;
export const PRAYER_KEYS = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'] as const;
export type PrayerKey = (typeof PRAYER_KEYS)[number];
export const PRAYER_TIME_KEYS = ['fajr', 'sunrise', 'dhuhr', 'asr', 'maghrib', 'isha'] as const;
export type PrayerTimeKey = (typeof PRAYER_TIME_KEYS)[number];

export function dayKeyInTimeZone(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? '';
  return `${value('year')}-${value('month')}-${value('day')}`;
}

export function calculatePrayerTimes(city: CityId, date: Date): PrayerTimes {
  const location = CITIES[city];
  const dayKey = dayKeyInTimeZone(date, location.timeZone);
  const [year, month, day] = dayKey.split('-').map(Number);
  const calculationDate = new Date(year, month - 1, day);

  return new PrayerTimes(
    new Coordinates(location.latitude, location.longitude),
    calculationDate,
    CalculationMethod.Egyptian(),
  );
}

export function formatPrayerTime(date: Date, locale: string, timeZone: string): string {
  return new Intl.DateTimeFormat(locale === 'ar' ? 'ar-EG' : 'en-US', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone,
  }).format(date);
}
