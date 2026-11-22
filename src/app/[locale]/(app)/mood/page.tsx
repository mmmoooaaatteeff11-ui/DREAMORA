import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { MoodCheckIn } from '@/components/mood/MoodCheckIn';
import { redirect } from '@/i18n/navigation';
import { addDaysToDateKey, dateKeyInTimeZone } from '@/lib/mood/date';
import { createClient } from '@/lib/supabase/server';
import { moodHistoryRowSchema, type MoodHistoryEntry } from '@/lib/validation/mood';

export async function generateMetadata({
  params: { locale },
}: {
  params: { locale: string };
}): Promise<Metadata> {
  const t = await getTranslations({ locale, namespace: 'mood' });
  return { title: t('metaTitle') };
}

export default async function MoodPage({ params: { locale } }: { params: { locale: string } }) {
  setRequestLocale(locale);

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return redirect({ href: '/login', locale });

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('timezone')
    .eq('id', user.id)
    .maybeSingle();
  const today = dateKeyInTimeZone(new Date(), profile?.timezone ?? 'Africa/Cairo');
  const firstDay = addDaysToDateKey(today, -13);
  const { data, error } = await supabase
    .from('mood_entries')
    .select('entry_date, mood, mood_key, note')
    .eq('user_id', user.id)
    .gte('entry_date', firstDay)
    .lte('entry_date', today)
    .order('entry_date', { ascending: true });

  const parsedEntries = (data ?? []).map((row) => moodHistoryRowSchema.safeParse(row));
  const loadError = Boolean(profileError || error || parsedEntries.some((result) => !result.success));
  const entries: MoodHistoryEntry[] = parsedEntries.flatMap((result) =>
    result.success
      ? [{ entryDate: result.data.entry_date, mood: result.data.mood, moodKey: result.data.mood_key }]
      : [],
  );
  const todayEntry = parsedEntries.find(
    (result) => result.success && result.data.entry_date === today,
  );
  const initialMoodKey = todayEntry?.success ? todayEntry.data.mood_key : null;
  const initialNote = todayEntry?.success ? todayEntry.data.note ?? '' : '';
  const t = await getTranslations('mood');

  return (
    <main className="mx-auto w-full max-w-4xl space-y-6 px-4 py-8">
      <header className="space-y-2">
        <p className="text-sm text-primary-light">{today}</p>
        <h1 className="font-heading text-3xl font-semibold sm:text-4xl">{t('title')}</h1>
        <p className="max-w-2xl text-muted">{t('description')}</p>
      </header>
      <MoodCheckIn
        today={today}
        entries={entries}
        initialMoodKey={initialMoodKey}
        initialNote={initialNote}
        loadError={loadError}
      />
    </main>
  );
}
