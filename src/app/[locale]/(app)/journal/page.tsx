import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { JournalClient } from '@/components/journal/JournalClient';
import { Card } from '@/components/ui/Card';
import { redirect } from '@/i18n/navigation';
import { createClient } from '@/lib/supabase/server';
import type { JournalEntry } from '@/lib/validation/journal';

export async function generateMetadata({
  params: { locale },
}: {
  params: { locale: string };
}): Promise<Metadata> {
  const t = await getTranslations({ locale, namespace: 'journal' });
  return { title: t('metaTitle') };
}

export default async function JournalPage({ params: { locale } }: { params: { locale: string } }) {
  setRequestLocale(locale);

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return redirect({ href: '/login', locale });

  const { data, error } = await supabase
    .from('journal_entries')
    .select('id,title,body,category,tags,created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .range(0, 20);
  const rows = (data ?? []) as JournalEntry[];

  const t = await getTranslations('journal');
  return (
    <main className="mx-auto w-full max-w-3xl space-y-6 px-4 py-8">
      <header className="space-y-2">
        <h1 className="font-heading text-3xl font-semibold sm:text-4xl">{t('title')}</h1>
        <p className="text-muted">{t('description')}</p>
      </header>
      {error ? (
        <Card>
          <p className="text-sm text-red-200">{t('errors.load_failed')}</p>
        </Card>
      ) : (
        <JournalClient
          initialEntries={rows.slice(0, 20)}
          initialHasMore={rows.length > 20}
          initialLoadError={false}
        />
      )}
    </main>
  );
}
