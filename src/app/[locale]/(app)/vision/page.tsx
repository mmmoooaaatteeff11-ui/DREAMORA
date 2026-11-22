import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { VisionBoard } from '@/components/vision/VisionBoard';
import { createClient } from '@/lib/supabase/server';
import { redirect } from '@/i18n/navigation';
import type { VisionItem } from '@/lib/validation/vision';

export async function generateMetadata({
  params: { locale },
}: {
  params: { locale: string };
}): Promise<Metadata> {
  const t = await getTranslations({ locale, namespace: 'vision' });
  return { title: t('metaTitle') };
}

export default async function VisionPage({ params: { locale } }: { params: { locale: string } }) {
  setRequestLocale(locale);

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return redirect({ href: '/login', locale });

  const { data, error } = await supabase
    .from('vision_items')
    .select('id,kind,content,emoji,color,x,y,z,size')
    .eq('user_id', user.id)
    .order('z', { ascending: true })
    .order('created_at', { ascending: true });

  const t = await getTranslations('vision');
  return (
    <main className="mx-auto w-full max-w-3xl space-y-6 px-4 py-8">
      <header className="space-y-2">
        <h1 className="font-heading text-3xl font-semibold sm:text-4xl">{t('title')}</h1>
        <p className="max-w-2xl text-muted">{t('description')}</p>
      </header>
      {error ? (
        <p role="alert" className="rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {t('errors.load_failed')}
        </p>
      ) : (
        <VisionBoard initialItems={(data ?? []) as VisionItem[]} />
      )}
    </main>
  );
}
