'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Card } from '@/components/ui/Card';
import {
  CITIES,
  calculatePrayerTimes,
  dayKeyInTimeZone,
  formatPrayerTime,
  PRAYER_KEYS,
  PRAYER_TIME_KEYS,
  type CityId,
  type PrayerKey,
  type PrayerTimeKey,
} from '@/lib/faith/prayer-times';
import { faithProgressSchema, type FaithProgress } from '@/lib/validation/faith';
import { reminderForDay } from '@/content/faith-reminders';

type Settings = {
  city: CityId;
  tracking: boolean;
  quranGoal: number;
  reminders: boolean;
  remembranceReminders: boolean;
};

type DhikrId = 'morning1' | 'morning2' | 'evening1' | 'evening2' | 'post1' | 'post2';
type Tab = 'morning' | 'evening' | 'afterPrayer';
type SyncMessage = 'tracking.error';

const EMPTY_COUNTS: FaithProgress['adhkar'] = {
  morning1: 0,
  morning2: 0,
  evening1: 0,
  evening2: 0,
  post1: 0,
  post2: 0,
};
const TARGETS: Record<DhikrId, number> = {
  morning1: 1,
  morning2: 1,
  evening1: 1,
  evening2: 1,
  post1: 3,
  post2: 1,
};
const DEFAULT_SETTINGS: Settings = {
  city: 'cairo',
  tracking: false,
  quranGoal: 0,
  reminders: false,
  remembranceReminders: false,
};
const PRAYER_STORAGE_PREFIX = 'dreamora.faith.settings.v1';

function blankProgress(date: string): FaithProgress {
  return { date, prayers: [], adhkar: { ...EMPTY_COUNTS }, tasbeehCount: 0, quranPages: 0 };
}

function settingsKey(userId: string): string {
  return `${PRAYER_STORAGE_PREFIX}.${userId}`;
}

function isCityId(value: string): value is CityId {
  return Object.prototype.hasOwnProperty.call(CITIES, value);
}

function dateKeyToUtcMidday(value: string, daysAfter: number): Date {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day + daysAfter, 12));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function readSettings(userId: string): Settings {
  const raw = window.localStorage.getItem(settingsKey(userId));
  if (!raw) return DEFAULT_SETTINGS;

  const value: unknown = JSON.parse(raw);
  if (!isRecord(value)) throw new Error('Invalid settings');

  const city = typeof value.city === 'string' && isCityId(value.city) ? value.city : 'cairo';
  return {
    city,
    tracking: value.tracking === true,
    quranGoal:
      typeof value.quranGoal === 'number' && Number.isInteger(value.quranGoal)
        ? Math.max(0, Math.min(604, value.quranGoal))
        : 0,
    reminders: value.reminders === true,
    remembranceReminders: value.remembranceReminders === true,
  };
}

function parseProgressResponse(value: unknown): FaithProgress | null {
  if (!isRecord(value) || !('progress' in value)) throw new Error('Invalid progress response');
  if (value.progress === null) return null;
  const parsed = faithProgressSchema.safeParse(value.progress);
  if (!parsed.success) throw new Error('Invalid progress data');
  return parsed.data;
}

function getVisibleAdhkar(tab: Tab): DhikrId[] {
  if (tab === 'morning') return ['morning1', 'morning2'];
  if (tab === 'evening') return ['evening1', 'evening2'];
  return ['post1', 'post2'];
}

function isPrayerKey(key: PrayerTimeKey): key is PrayerKey {
  return key !== 'sunrise';
}

export function FaithClient({ userId }: { userId: string }) {
  const locale = useLocale();
  const t = useTranslations('faith');
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [progress, setProgress] = useState<FaithProgress>(() => blankProgress(''));
  const [ready, setReady] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const [loadedDate, setLoadedDate] = useState('');
  const [loadingProgress, setLoadingProgress] = useState(false);
  const [savingProgress, setSavingProgress] = useState(false);
  const [syncMessage, setSyncMessage] = useState<SyncMessage | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [loadVersion, setLoadVersion] = useState(0);
  const [saveVersion, setSaveVersion] = useState(0);
  const [storageError, setStorageError] = useState(false);
  const [progressDeleted, setProgressDeleted] = useState(false);
  const [tab, setTab] = useState<Tab>('morning');
  const [reminderError, setReminderError] = useState<'unsupported' | 'permissionDenied' | null>(null);
  const [creditBalance, setCreditBalance] = useState<number | null>(null);
  const [creditError, setCreditError] = useState(false);
  const [creditMessage, setCreditMessage] = useState('');
  const [routineCredit, setRoutineCredit] = useState<{ awarded: number; reason: string } | null>(null);
  const [claimingCredit, setClaimingCredit] = useState(false);
  const lastSavedRef = useRef('');

  const city = CITIES[settings.city];
  const today = dayKeyInTimeZone(now, city.timeZone);
  const peaceReminder = useMemo(() => reminderForDay(today), [today]);
  const prayerTimes = useMemo(
    () => calculatePrayerTimes(settings.city, dateKeyToUtcMidday(today, 0)),
    [settings.city, today],
  );
  const prayerEntries = useMemo(
    () => PRAYER_TIME_KEYS.map((key) => ({ key, time: prayerTimes[key] })),
    [prayerTimes],
  );
  const nextPrayerToday = prayerEntries
    .filter(({ key }) => isPrayerKey(key))
    .find(({ time }) => time.getTime() > now.getTime());
  const nextPrayer = nextPrayerToday ?? {
    key: 'fajr' as const,
    time: calculatePrayerTimes(settings.city, dateKeyToUtcMidday(today, 1)).fajr,
  };
  const pageGoalMet = settings.quranGoal > 0 && progress.quranPages >= settings.quranGoal;
  const completedAdhkar = (Object.keys(TARGETS) as DhikrId[]).filter(
    (key) => progress.adhkar[key] >= TARGETS[key],
  ).length;
  const progressTotal = PRAYER_KEYS.length + Object.keys(TARGETS).length + (settings.quranGoal > 0 ? 1 : 0);
  const progressDone =
    progress.prayers.length + completedAdhkar + (settings.quranGoal > 0 && pageGoalMet ? 1 : 0);
  const progressReady = !settings.tracking || (!loadingProgress && loadedDate === today);
  const tasbeehLabel =
    progress.tasbeehCount >= 100
      ? t('tasbeeh.complete')
      : progress.tasbeehCount === 99
        ? t('tasbeeh.finalTahlil')
        : t(
            `tasbeeh.${(['subhanallah', 'alhamdulillah', 'allahuakbar'] as const)[Math.floor(progress.tasbeehCount / 33)]}`,
          );

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    try {
      setSettings(readSettings(userId));
      setStorageError(false);
    } catch {
      setSettings(DEFAULT_SETTINGS);
      setStorageError(true);
    }
    setReady(true);
  }, [userId]);

  useEffect(() => {
    if (!ready) return;
    try {
      window.localStorage.setItem(settingsKey(userId), JSON.stringify(settings));
      setStorageError(false);
    } catch {
      setStorageError(true);
    }
  }, [ready, settings, userId]);

  useEffect(() => {
    if (!ready) return;
    if (!settings.tracking) {
      setLoadingProgress(false);
      setLoadError(false);
      const empty = blankProgress(today);
      setProgress(empty);
      lastSavedRef.current = JSON.stringify(empty);
      setLoadedDate(today);
      return;
    }

    let active = true;
    setLoadingProgress(true);
    setLoadError(false);
    fetch(`/api/faith/progress?date=${encodeURIComponent(today)}`, { cache: 'no-store' })
      .then(async (response) => {
        if (!response.ok) throw new Error('Progress unavailable');
        return parseProgressResponse(await response.json());
      })
      .then((saved) => {
        if (!active) return;
        const next = saved ?? blankProgress(today);
        setProgress(next);
        lastSavedRef.current = JSON.stringify(next);
        setLoadedDate(today);
        setSyncMessage(null);
      })
      .catch(() => {
        if (!active) return;
        setLoadError(true);
        setSyncMessage('tracking.error');
      })
      .finally(() => {
        if (active) setLoadingProgress(false);
      });

    return () => {
      active = false;
    };
  }, [ready, settings.tracking, today, loadVersion]);

  useEffect(() => {
    if (!ready || !settings.tracking || loadingProgress || loadedDate !== today || loadError) return;
    const serialized = JSON.stringify(progress);
    if (serialized === lastSavedRef.current || savingProgress) return;

    const timer = window.setTimeout(() => {
      setSavingProgress(true);
      fetch('/api/faith/progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: serialized,
      })
        .then(async (response) => {
          if (!response.ok) throw new Error('Progress unavailable');
          const value: unknown = await response.json();
          if (
            isRecord(value) &&
            typeof value.awarded === 'number' &&
            Number.isInteger(value.awarded) &&
            value.awarded >= 0 &&
            typeof value.reason === 'string'
          ) {
            const awarded = value.awarded;
            setRoutineCredit({ awarded, reason: value.reason });
            if (awarded > 0) {
              setCreditBalance((current) => (current === null ? null : current + awarded));
            }
          }
          lastSavedRef.current = serialized;
          setSyncMessage(null);
        })
        .catch(() => setSyncMessage('tracking.error'))
        .finally(() => setSavingProgress(false));
    }, 450);

    return () => window.clearTimeout(timer);
  }, [ready, settings.tracking, progress, today, loadedDate, loadingProgress, savingProgress, loadError, saveVersion]);

  useEffect(() => {
    if (!ready || !settings.reminders || !('Notification' in window)) return;
    if (Notification.permission !== 'granted') return;

    const due = prayerEntries.find(
      ({ key, time }) =>
        isPrayerKey(key) && now.getTime() >= time.getTime() && now.getTime() - time.getTime() < 60_000,
    );
    if (!due || !isPrayerKey(due.key)) return;

    const reminderKey = `${settingsKey(userId)}.reminder.${today}.${due.key}`;
    try {
      if (window.localStorage.getItem(reminderKey)) return;
      new Notification(t(`prayerTimes.${due.key}`), {
        body: t('reminders.message', { prayer: t(`prayerTimes.${due.key}`) }),
      });
      window.localStorage.setItem(reminderKey, 'sent');
    } catch {
      setReminderError('unsupported');
    }
  }, [now, prayerEntries, ready, settings.reminders, t, today, userId]);

  useEffect(() => {
    if (!ready || !settings.remembranceReminders || !('Notification' in window)) return;
    if (Notification.permission !== 'granted') return;

    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: city.timeZone,
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(now);
    const hour = Number(parts.find((part) => part.type === 'hour')?.value);
    const minute = Number(parts.find((part) => part.type === 'minute')?.value);
    const localMinutes = hour * 60 + minute;
    const due = [
      { kind: 'morning', at: 8 * 60 },
      { kind: 'evening', at: 20 * 60 },
    ].find(({ at }) => localMinutes >= at && localMinutes < at + 1);
    if (!due) return;

    const reminderKey = `${settingsKey(userId)}.reminder.${today}.${due.kind}`;
    try {
      if (window.localStorage.getItem(reminderKey)) return;
      new Notification(t('reminders.remembranceTitle'), { body: t('reminders.remembranceMessage') });
      window.localStorage.setItem(reminderKey, 'sent');
    } catch {
      setReminderError('unsupported');
    }
  }, [city.timeZone, now, ready, settings.remembranceReminders, t, today, userId]);

  useEffect(() => {
    if (!ready) return;
    fetch('/api/faith/credits', { cache: 'no-store' })
      .then(async (response) => {
        if (!response.ok) throw new Error('Credits unavailable');
        const value: unknown = await response.json();
        if (!isRecord(value) || typeof value.balance !== 'number' || !Number.isInteger(value.balance) || value.balance < 0) {
          throw new Error('Invalid credit balance');
        }
        setCreditBalance(value.balance);
      })
      .catch(() => setCreditError(true));
  }, [ready]);

  function updateProgress(update: (current: FaithProgress) => FaithProgress) {
    setProgressDeleted(false);
    setProgress((current) => update(current));
  }

  function togglePrayer(key: PrayerKey) {
    updateProgress((current) => ({
      ...current,
      prayers: current.prayers.includes(key)
        ? current.prayers.filter((prayer) => prayer !== key)
        : [...current.prayers, key],
    }));
  }

  function incrementDhikr(key: DhikrId) {
    updateProgress((current) => ({
      ...current,
      adhkar: { ...current.adhkar, [key]: Math.min(TARGETS[key], current.adhkar[key] + 1) },
    }));
  }

  async function enableReminders(kind: 'prayer' | 'remembrance') {
    if (!('Notification' in window)) {
      setReminderError('unsupported');
      return;
    }
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setReminderError('permissionDenied');
        return;
      }
    } catch {
      setReminderError('permissionDenied');
      return;
    }
    setReminderError(null);
    setSettings((current) => ({
      ...current,
      [kind === 'prayer' ? 'reminders' : 'remembranceReminders']: true,
    }));
  }

  async function deleteProgress() {
    if (!window.confirm(t('tracking.deleteConfirm'))) return;
    try {
      const response = await fetch('/api/faith/progress', { method: 'DELETE' });
      if (!response.ok) throw new Error('Progress unavailable');
      const empty = blankProgress(today);
      setProgress(empty);
      lastSavedRef.current = JSON.stringify(empty);
      setLoadedDate(today);
      setSyncMessage(null);
      setLoadError(false);
      setProgressDeleted(true);
    } catch {
      setSyncMessage('tracking.error');
    }
  }

  async function claimCredit() {
    setClaimingCredit(true);
    setCreditMessage('');
    setCreditError(false);
    try {
      const response = await fetch('/api/faith/credits', { method: 'POST' });
      if (!response.ok) throw new Error('Credit claim unavailable');
      const value: unknown = await response.json();
      if (
        !isRecord(value) ||
        typeof value.balance !== 'number' ||
        !Number.isInteger(value.balance) ||
        value.balance < 0 ||
        typeof value.awarded !== 'boolean'
      ) {
        throw new Error('Invalid credit claim');
      }
      setCreditBalance(value.balance);
      setCreditMessage(value.awarded ? t('credits.claimed') : t('credits.alreadyClaimed'));
    } catch {
      setCreditError(true);
    } finally {
      setClaimingCredit(false);
    }
  }

  const dateLabel = new Intl.DateTimeFormat(locale === 'ar' ? 'ar-EG' : 'en-US', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: city.timeZone,
  }).format(now);

  return (
    <main className="mx-auto w-full max-w-5xl space-y-6 px-4 py-8">
      <header className="space-y-2">
        <p className="text-sm text-primary-light">{dateLabel}</p>
        <h1 className="font-heading text-3xl font-semibold sm:text-4xl">{t('title')}</h1>
        <p className="max-w-2xl text-muted">{t('subtitle')}</p>
      </header>

      <Card className="border-primary/30 bg-gradient-to-br from-primary/20 via-base/70 to-transparent">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm text-muted">{t('nextPrayer')}</p>
            {nextPrayer ? (
              <p className="mt-1 font-heading text-2xl font-semibold">
                {t(`prayerTimes.${nextPrayer.key}`)}{' '}
                <span className="text-primary-light">
                  {formatPrayerTime(nextPrayer.time, locale, city.timeZone)}
                </span>
              </p>
            ) : (
              <p className="mt-1 text-muted">{t('noNextPrayer')}</p>
            )}
          </div>
          <label className="grid gap-2 text-sm">
            <span className="text-muted">{t('cityLabel')}</span>
            <select
              value={settings.city}
              onChange={(event) => {
                const nextCity = event.target.value;
                if (isCityId(nextCity)) {
                  setSettings((current) => ({ ...current, city: nextCity }));
                }
              }}
              className="min-w-48 rounded-xl border border-glass-border bg-base px-4 py-3 text-ink"
            >
              {(Object.keys(CITIES) as CityId[]).map((id) => (
                <option key={id} value={id}>
                  {t(`cities.${id}`)}
                </option>
              ))}
            </select>
          </label>
        </div>
        <p className="mt-4 text-xs text-muted">{t('method')}</p>
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {prayerEntries.map(({ key, time }) => {
            const next = nextPrayerToday?.key === key;
            return (
              <div
                key={key}
                className={`rounded-xl border p-3 ${next ? 'border-primary/50 bg-primary/15' : 'border-glass-border bg-white/[0.03]'}`}
              >
                <p className="text-sm text-muted">{t(`prayerTimes.${key}`)}</p>
                <p className="mt-1 font-semibold" dir="ltr">
                  {formatPrayerTime(time, locale, city.timeZone)}
                </p>
              </div>
            );
          })}
        </div>
      </Card>

      <Card>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-heading text-xl font-semibold">{t('tracking.title')}</h2>
            <p className="mt-1 max-w-2xl text-sm text-muted">{t('tracking.description')}</p>
            <p className="mt-2 text-sm text-primary-light">
              {settings.tracking ? t('tracking.enabled') : t('tracking.disabled')}
            </p>
          </div>
          <button
            type="button"
            aria-pressed={settings.tracking}
            onClick={() => setSettings((current) => ({ ...current, tracking: !current.tracking }))}
            className="rounded-pill border border-primary/40 px-5 py-3 text-sm font-semibold text-primary-light transition hover:bg-primary/10"
          >
            {settings.tracking ? t('tracking.disable') : t('tracking.enable')}
          </button>
        </div>
        {settings.tracking && (
          <div className="mt-6 flex flex-col gap-5 border-t border-glass-border pt-5 sm:flex-row sm:items-center">
            <div
              className="relative grid h-28 w-28 shrink-0 place-items-center rounded-full"
              role="img"
              aria-label={t('progress.summary', { done: progressDone, total: progressTotal })}
              style={{
                background: `conic-gradient(#a78bfa ${(progressDone / progressTotal) * 360}deg, rgba(255,255,255,.1) 0deg)`,
              }}
            >
              <div className="grid h-20 w-20 place-items-center rounded-full bg-base text-center">
                <span className="text-xl font-semibold">{Math.round((progressDone / progressTotal) * 100)}%</span>
              </div>
            </div>
            <div>
              <h3 className="font-semibold">{t('progress.title')}</h3>
              <p className="mt-1 text-sm text-primary-light">
                {t('progress.summary', { done: progressDone, total: progressTotal })}
              </p>
              <p className="mt-1 text-sm text-muted">{t('progress.note')}</p>
              {loadingProgress && <p className="mt-2 text-xs text-muted">{t('tracking.loading')}</p>}
              {savingProgress && <p className="mt-2 text-xs text-muted">{t('tracking.saving')}</p>}
              {syncMessage && (
                <p className="mt-2 text-sm text-rose-300" role="alert">
                  {t(syncMessage)}
                  {loadError ? (
                    <button
                      type="button"
                      onClick={() => setLoadVersion((value) => value + 1)}
                      className="ms-2 underline"
                    >
                      {t('tracking.retry')}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setSaveVersion((value) => value + 1)}
                      className="ms-2 underline"
                    >
                      {t('tracking.retry')}
                    </button>
                  )}
                </p>
              )}
            </div>
          </div>
        )}
        <button type="button" onClick={deleteProgress} className="mt-4 text-sm text-muted underline">
          {t('tracking.delete')}
        </button>
        {progressDeleted && <p className="mt-2 text-sm text-primary-light" role="status">{t('tracking.deleted')}</p>}
        {storageError && <p className="mt-4 text-sm text-rose-300" role="alert">{t('tracking.storageError')}</p>}
      </Card>

      {settings.tracking && (
        <Card>
          <h2 className="font-heading text-xl font-semibold">{t('peaceReminder.title')}</h2>
          <div className="mt-5 space-y-4">
            <blockquote className="text-lg leading-9 text-primary-light sm:text-xl" dir="rtl">
              {peaceReminder.ar}
            </blockquote>
            <div className="text-sm">
              <p className="font-medium text-muted">{t('peaceReminder.source')}</p>
              <p className="mt-1">
                {locale === 'ar' ? peaceReminder.sourceAr : peaceReminder.sourceEn}
              </p>
            </div>
            <div className="text-sm">
              <p className="font-medium text-muted">{t('peaceReminder.meaning')}</p>
              <p className="mt-1">
                {locale === 'ar' ? peaceReminder.meaningAr : peaceReminder.meaningEn}
              </p>
            </div>
            <div className="rounded-xl border border-glass-border bg-white/[0.03] p-4 text-sm">
              <p className="font-medium text-muted">{t('peaceReminder.gentleStep')}</p>
              <p className="mt-1">
                {locale === 'ar' ? peaceReminder.gentleAr : peaceReminder.gentleEn}
              </p>
            </div>
          </div>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-[1.05fr_.95fr]">
        <Card>
          <h2 className="font-heading text-xl font-semibold">{t('prayers.title')}</h2>
          <p className="mt-1 text-sm text-muted">{t('prayers.trackNote')}</p>
          <div className="mt-4 space-y-2">
            {PRAYER_KEYS.map((key: PrayerKey) => {
              const checked = progress.prayers.includes(key);
              return (
                <button
                  type="button"
                  key={key}
                  aria-pressed={checked}
                  disabled={!progressReady}
                  onClick={() => togglePrayer(key)}
                  className="flex w-full items-center justify-between rounded-xl border border-glass-border px-4 py-3 text-start transition hover:bg-white/5 disabled:cursor-wait disabled:opacity-50"
                >
                  <span>{t(`prayerTimes.${key}`)}</span>
                  <span className={`grid h-6 w-6 place-items-center rounded-full border ${checked ? 'border-primary bg-primary text-white' : 'border-muted text-transparent'}`}>
                    ✓
                  </span>
                </button>
              );
            })}
          </div>
        </Card>

        <Card>
          <h2 className="font-heading text-xl font-semibold">{t('adhkar.title')}</h2>
          <div className="mt-4 flex flex-wrap gap-2" role="tablist" aria-label={t('adhkar.title')}>
            {(['morning', 'evening', 'afterPrayer'] as const).map((value) => (
              <button
                type="button"
                role="tab"
                aria-selected={tab === value}
                key={value}
                onClick={() => setTab(value)}
                className={`rounded-pill px-4 py-2 text-sm ${tab === value ? 'bg-primary/25 text-primary-light' : 'text-muted hover:bg-white/5'}`}
              >
                {t(`adhkar.${value}`)}
              </button>
            ))}
          </div>
          <div className="mt-4 space-y-3">
            {getVisibleAdhkar(tab).map((id) => {
              const count = progress.adhkar[id];
              const target = TARGETS[id];
              const complete = count >= target;
              return (
                <article key={id} className="rounded-xl border border-glass-border bg-white/[0.03] p-4">
                  <p className="leading-8" dir="rtl">{t(`adhkar.${id}.text`)}</p>
                  {locale === 'en' ? (
                    <p className="mt-2 text-sm text-muted">{t(`adhkar.${id}.meaning`)}</p>
                  ) : (
                    <details className="mt-2 text-sm text-muted">
                      <summary className="cursor-pointer">{t('adhkar.readMeaning')}</summary>
                      <p className="mt-2">{t(`adhkar.${id}.meaning`)}</p>
                    </details>
                  )}
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                    <div className="text-xs text-muted">
                      <p>{t(`adhkar.${id}.reference`)}</p>
                      <p>{t(`adhkar.${id}.count`)}</p>
                    </div>
                    <button
                      type="button"
                      disabled={!progressReady || complete}
                      onClick={() => incrementDhikr(id)}
                      className="rounded-pill border border-primary/40 px-4 py-2 text-sm text-primary-light transition hover:bg-primary/10 disabled:opacity-60"
                    >
                      {complete ? t('adhkar.done') : `${t('adhkar.repeat')} ${count}/${target}`}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="font-heading text-xl font-semibold">{t('tasbeeh.title')}</h2>
              <p className="mt-1 text-sm text-muted">{t('tasbeeh.description')}</p>
              <p className="mt-2 text-xs text-muted">{t('tasbeeh.reference')}</p>
            </div>
            <span className="rounded-xl bg-primary/15 px-3 py-2 text-lg font-semibold" aria-live="polite">
              {progress.tasbeehCount}/100
            </span>
          </div>
          <p className="mt-5 text-center text-lg text-primary-light">{tasbeehLabel}</p>
          <div className="mt-4 flex justify-center gap-3">
            <button
              type="button"
              disabled={!progressReady || progress.tasbeehCount >= 100}
              onClick={() => updateProgress((current) => ({ ...current, tasbeehCount: Math.min(100, current.tasbeehCount + 1) }))}
              className="min-w-36 rounded-pill bg-gradient-to-r from-[#6D28D9] to-primary px-6 py-3 font-semibold text-white shadow-glow disabled:opacity-50"
            >
              {t('tasbeeh.tap')}
            </button>
            <button
              type="button"
              disabled={!progressReady}
              onClick={() => updateProgress((current) => ({ ...current, tasbeehCount: 0 }))}
              className="rounded-pill border border-glass-border px-5 py-3 text-muted hover:bg-white/5 disabled:opacity-50"
            >
              {t('tasbeeh.reset')}
            </button>
          </div>
        </Card>

        <Card>
          <h2 className="font-heading text-xl font-semibold">{t('quran.title')}</h2>
          <p className="mt-1 text-sm text-muted">{t('quran.description')}</p>
          <label className="mt-4 grid max-w-xs gap-2 text-sm">
            <span className="text-muted">{t('quran.goal')}</span>
            <select
              value={settings.quranGoal}
              onChange={(event) => setSettings((current) => ({ ...current, quranGoal: Number(event.target.value) }))}
              className="rounded-xl border border-glass-border bg-base px-4 py-3 text-ink"
            >
              <option value={0}>{t('quran.off')}</option>
              {[1, 2, 3, 5, 10, 20].map((goal) => <option key={goal} value={goal}>{goal}</option>)}
            </select>
          </label>
          {settings.quranGoal > 0 && (
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button
                type="button"
                disabled={!progressReady || progress.quranPages === 0}
                onClick={() => updateProgress((current) => ({ ...current, quranPages: Math.max(0, current.quranPages - 1) }))}
                aria-label={t('quran.subtractPage')}
                className="grid h-11 w-11 place-items-center rounded-full border border-glass-border text-xl disabled:opacity-50"
              >
                −
              </button>
              <span className="min-w-24 text-center font-semibold" aria-live="polite">
                {t('quran.pages')}: {progress.quranPages}/{settings.quranGoal}
              </span>
              <button
                type="button"
                disabled={!progressReady || progress.quranPages >= 604}
                onClick={() => updateProgress((current) => ({ ...current, quranPages: Math.min(604, current.quranPages + 1) }))}
                aria-label={t('quran.addPage')}
                className="grid h-11 w-11 place-items-center rounded-full border border-primary/40 text-xl text-primary-light disabled:opacity-50"
              >
                +
              </button>
            </div>
          )}
          {pageGoalMet && <p className="mt-3 text-sm text-primary-light">{t('quran.complete')}</p>}
        </Card>
      </div>

      <Card>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-heading text-xl font-semibold">{t('reminders.title')}</h2>
            <p className="mt-1 text-sm text-muted">{t('reminders.tabNote')}</p>
            <p className="mt-1 text-sm text-muted">{t('reminders.remembranceSchedule')}</p>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-3">
          <button
            type="button"
            aria-pressed={settings.reminders}
            onClick={() => {
              if (settings.reminders) setSettings((current) => ({ ...current, reminders: false }));
              else void enableReminders('prayer');
            }}
            className="rounded-pill border border-glass-border px-5 py-3 text-sm text-primary-light transition hover:bg-white/5"
          >
            {settings.reminders ? t('reminders.disable') : t('reminders.enable')}
          </button>
          <button
            type="button"
            aria-pressed={settings.remembranceReminders}
            onClick={() => {
              if (settings.remembranceReminders) {
                setSettings((current) => ({ ...current, remembranceReminders: false }));
              } else {
                void enableReminders('remembrance');
              }
            }}
            className="rounded-pill border border-glass-border px-5 py-3 text-sm text-primary-light transition hover:bg-white/5"
          >
            {settings.remembranceReminders
              ? t('reminders.disableRemembrance')
              : t('reminders.enableRemembrance')}
          </button>
        </div>
        {reminderError && <p className="mt-3 text-sm text-rose-300" role="alert">{t(`reminders.${reminderError}`)}</p>}
      </Card>

      <Card className="border-blue-400/20 bg-gradient-to-br from-blue-500/10 to-transparent">
        <h2 className="font-heading text-lg font-semibold">{t('wellbeing.title')}</h2>
        <p className="mt-2 leading-7 text-muted">{t('wellbeing.body')}</p>
      </Card>

      <Card>
        <h2 className="font-heading text-lg font-semibold">{t('credits.title')}</h2>
        <p className="mt-2 text-sm leading-7 text-muted">{t('credits.description')}</p>
        {routineCredit && routineCredit.awarded > 0 && (
          <p className="mt-3 text-sm text-primary-light" role="status">
            {t('credits.routineAwarded', { n: routineCredit.awarded })}
          </p>
        )}
        {routineCredit?.reason === 'too_early' && (
          <p className="mt-3 text-sm text-muted">{t('credits.routineTooEarly')}</p>
        )}
        {creditBalance !== null && (
          <p className="mt-3 text-sm text-primary-light">{t('credits.balance', { balance: creditBalance })}</p>
        )}
        {creditError && <p className="mt-3 text-sm text-rose-300" role="alert">{t('credits.error')}</p>}
        {creditMessage && <p className="mt-3 text-sm text-primary-light" role="status">{creditMessage}</p>}
        <button
          type="button"
          disabled={claimingCredit}
          onClick={() => void claimCredit()}
          className="mt-4 rounded-pill border border-primary/40 px-5 py-3 text-sm font-semibold text-primary-light transition hover:bg-primary/10 disabled:opacity-50"
        >
          {t('credits.claim')}
        </button>
      </Card>
    </main>
  );
}
