'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Link, useRouter } from '@/i18n/navigation';
import { addDaysToDateKey } from '@/lib/mood/date';
import { MOOD_OPTIONS, type MoodHistoryEntry, type MoodKey } from '@/lib/validation/mood';
import { saveMood } from '@/server/services/mood';

const QUICK_MOODS: MoodKey[] = ['joyful', 'grateful', 'calm', 'tired', 'anxious'];
const SUPPORT_MOODS = new Set<MoodKey>(['sad', 'anxious', 'lonely', 'angry']);

function useMoodSave(initialMoodKey: MoodKey | null = null) {
  const router = useRouter();
  const [selectedMood, setSelectedMood] = useState<MoodKey | null>(initialMoodKey);
  const [savingMood, setSavingMood] = useState<MoodKey | null>(null);
  const [saved, setSaved] = useState(false);
  const [errorCode, setErrorCode] = useState<string | null>(null);

  async function save(moodKey: MoodKey, note?: string) {
    if (savingMood) return;
    setSavingMood(moodKey);
    setSaved(false);
    setErrorCode(null);

    try {
      const result = await saveMood(note ? { moodKey, note } : { moodKey });
      if (result.status === 'success') {
        setSelectedMood(moodKey);
        setSaved(true);
        router.refresh();
      } else {
        setErrorCode(result.code ?? 'generic');
      }
    } catch {
      setErrorCode('generic');
    } finally {
      setSavingMood(null);
    }
  }

  return { selectedMood, setSelectedMood, savingMood, saved, errorCode, save };
}

function MoodButtons({
  keys,
  selectedMood,
  savingMood,
  compact = false,
  onSelect,
}: {
  keys: readonly MoodKey[];
  selectedMood: MoodKey | null;
  savingMood: MoodKey | null;
  compact?: boolean;
  onSelect: (key: MoodKey) => void;
}) {
  const t = useTranslations('mood');
  const isSaving = savingMood !== null;

  return (
    <div className={compact ? 'flex flex-wrap gap-2' : 'grid grid-cols-2 gap-3 sm:grid-cols-5'}>
      {keys.map((key) => {
        const mood = MOOD_OPTIONS.find((option) => option.key === key);
        if (!mood) return null;
        const selected = selectedMood === key;
        return (
          <button
            type="button"
            key={key}
            aria-pressed={selected}
            disabled={isSaving}
            onClick={() => onSelect(key)}
            className={`flex items-center gap-2 rounded-xl border px-3 py-3 text-start transition hover:bg-white/10 disabled:opacity-60 ${
              selected ? 'border-primary/60 bg-primary/15 text-ink' : 'border-glass-border bg-glass text-muted'
            } ${compact ? 'min-h-11' : 'min-h-16 flex-col justify-center sm:flex-row'}`}
          >
            <span className="text-xl" aria-hidden="true">{mood.emoji}</span>
            <span className="text-sm">{t(`moods.${key}`)}</span>
          </button>
        );
      })}
    </div>
  );
}

function MoodFeedback({
  moodKey,
  saved,
  errorCode,
}: {
  moodKey: MoodKey | null;
  saved: boolean;
  errorCode: string | null;
}) {
  const t = useTranslations('mood');

  return (
    <div className="space-y-3">
      {saved && <Alert tone="success">{t('saved')}</Alert>}
      {errorCode && <Alert>{t(`errors.${errorCode}`)}</Alert>}
      {moodKey && SUPPORT_MOODS.has(moodKey) && (
        <div className="rounded-xl border border-primary/20 bg-primary/10 px-4 py-3 text-sm">
          <p>{t('support.gentleLine')}</p>
          <Link href="/companion" className="mt-2 inline-block font-medium text-primary-light hover:underline">
            {t('support.companion')}
          </Link>
        </div>
      )}
    </div>
  );
}

export function MoodCheckIn({
  today,
  entries,
  initialMoodKey,
  initialNote,
  loadError,
}: {
  today: string;
  entries: MoodHistoryEntry[];
  initialMoodKey: MoodKey | null;
  initialNote: string;
  loadError: boolean;
}) {
  const t = useTranslations('mood');
  const locale = useLocale();
  const { selectedMood, setSelectedMood, savingMood, saved, errorCode, save } = useMoodSave(initialMoodKey);
  const [note, setNote] = useState(initialNote);
  const days = Array.from({ length: 14 }, (_, index) => addDaysToDateKey(today, index - 13));
  const entriesByDate = new Map(entries.map((entry) => [entry.entryDate, entry]));

  return (
    <div className="space-y-6">
      <Card>
        <h2 className="font-heading text-xl font-semibold">{t('checkInTitle')}</h2>
        <p className="mt-1 text-sm text-muted">{t('checkInDescription')}</p>
        <div className="mt-5">
          <MoodButtons
            keys={MOOD_OPTIONS.map(({ key }) => key)}
            selectedMood={selectedMood}
            savingMood={savingMood}
            onSelect={(key) => {
              setSelectedMood(key);
            }}
          />
        </div>
        <label htmlFor="mood-note" className="mt-5 block text-sm font-medium">
          {t('noteLabel')}
        </label>
        <textarea
          id="mood-note"
          value={note}
          maxLength={1000}
          onChange={(event) => setNote(event.target.value)}
          placeholder={t('notePlaceholder')}
          className="mt-2 min-h-28 w-full resize-y rounded-xl border border-glass-border bg-glass px-4 py-3 text-ink outline-none placeholder:text-muted/70 focus:border-primary-light focus:ring-2 focus:ring-primary-light/40"
        />
        <p className="mt-1 text-end text-xs text-muted">{note.length}/1000</p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button
            type="button"
            disabled={!selectedMood || savingMood !== null}
            loading={savingMood !== null}
            onClick={() => selectedMood && void save(selectedMood, note)}
          >
            {savingMood ? t('saving') : t('save')}
          </Button>
          <MoodFeedback moodKey={selectedMood} saved={saved} errorCode={errorCode} />
        </div>
      </Card>

      <Card>
        <h2 className="font-heading text-xl font-semibold">{t('history.title')}</h2>
        <p className="mt-1 text-sm text-muted">{t('history.description')}</p>
        {loadError ? (
          <Alert className="mt-4">{t('errors.load_failed')}</Alert>
        ) : entries.length === 0 ? (
          <p className="mt-5 rounded-xl border border-glass-border px-4 py-5 text-sm text-muted">
            {t('history.empty')}
          </p>
        ) : (
          <div className="mt-6">
            <div className="flex h-40 items-end gap-1.5" role="img" aria-label={t('history.chartLabel')}>
              {days.map((date) => {
                const entry = entriesByDate.get(date);
                const isToday = date === today;
                const height = entry ? `${entry.mood * 20}%` : '4%';
                return (
                  <div key={date} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-2">
                    <div
                      aria-hidden="true"
                      className={`w-full rounded-t-md ${entry ? (isToday ? 'bg-primary' : 'bg-primary/45') : 'bg-white/10'} ${
                        isToday ? 'ring-2 ring-primary-light ring-offset-2 ring-offset-base' : ''
                      }`}
                      style={{ height }}
                      title={
                        entry
                          ? t('history.dayScore', { date, score: entry.mood })
                          : t('history.dayEmpty', { date })
                      }
                    />
                    <span className={`text-[10px] ${isToday ? 'font-semibold text-primary-light' : 'text-muted'}`}>
                      {new Intl.DateTimeFormat(locale === 'ar' ? 'ar-EG' : 'en-US', {
                        day: 'numeric',
                        timeZone: 'UTC',
                      }).format(new Date(`${date}T12:00:00.000Z`))}
                    </span>
                    {isToday && <span className="sr-only">{t('history.today')}</span>}
                  </div>
                );
              })}
            </div>
            <div className="mt-4 flex items-center justify-between text-xs text-muted">
              <span>{t('history.low')}</span>
              <span className="text-primary-light">{t('history.today')}</span>
              <span>{t('history.high')}</span>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}

export function MoodQuickCheckIn() {
  const t = useTranslations('mood');
  const { selectedMood, savingMood, saved, errorCode, save } = useMoodSave();

  return (
    <Card>
      <h2 className="font-heading text-lg font-semibold">{t('quickTitle')}</h2>
      <p className="mt-1 text-sm text-muted">{t('quickDescription')}</p>
      <div className="mt-4">
        <MoodButtons
          keys={QUICK_MOODS}
          selectedMood={selectedMood}
          savingMood={savingMood}
          compact
          onSelect={(key) => void save(key)}
        />
      </div>
      <div className="mt-3">
        <MoodFeedback moodKey={selectedMood} saved={saved} errorCode={errorCode} />
      </div>
    </Card>
  );
}
