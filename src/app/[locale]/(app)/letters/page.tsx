import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { LettersClient } from '@/components/letters/LettersClient';
import { createClient } from '@/lib/supabase/server';
import { dateKeyInTimeZone, letterDateLimits } from '@/lib/letters/date';
import { redirect } from '@/i18n/navigation';
import type { ArrivedLetter, WaitingLetter } from '@/lib/validation/letters';

export async function generateMetadata({
  params: { locale },
}: {
  params: { locale: string };
}): Promise<Metadata> {
  const t = await getTranslations({ locale, namespace: 'letters' });
  return { title: t('metaTitle') };
}

export default async function LettersPage({ params: { locale } }: { params: { locale: string } }) {
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
  const timeZone = profile?.timezone ?? 'Africa/Cairo';
  const today = dateKeyInTimeZone(new Date(), timeZone);
  const { minDate, maxDate } = letterDateLimits(today);

  const [waitingResult, arrivedResult] = await Promise.all([
    supabase
      .from('future_letters')
      .select('id,title,deliver_on')
      .eq('user_id', user.id)
      .gt('deliver_on', today)
      .order('deliver_on', { ascending: true }),
    supabase
      .from('future_letters')
      .select('id,title,deliver_on,delivered_at')
      .eq('user_id', user.id)
      .lte('deliver_on', today)
      .order('deliver_on', { ascending: false }),
  ]);

  return (
    <main className="mx-auto w-full max-w-3xl space-y-6 px-4 py-8">
      <header className="space-y-2">
        <h1 className="font-heading text-3xl font-semibold sm:text-4xl">
          {(await getTranslations('letters'))('title')}
        </h1>
        <p className="text-muted">{(await getTranslations('letters'))('description')}</p>
      </header>
      <LettersClient
        today={today}
        minDate={minDate}
        maxDate={maxDate}
        initialWaiting={(waitingResult.data ?? []) as WaitingLetter[]}
        initialArrived={(arrivedResult.data ?? []) as ArrivedLetter[]}
        loadError={Boolean(profileError || waitingResult.error || arrivedResult.error)}
      />
    </main>
  );
}
