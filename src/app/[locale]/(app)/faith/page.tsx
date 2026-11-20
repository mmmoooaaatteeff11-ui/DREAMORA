import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { FaithClient } from '@/components/faith/FaithClient';
import { redirect } from '@/i18n/navigation';
import { createClient } from '@/lib/supabase/server';

export async function generateMetadata({ params: { locale } }: { params: { locale: string } }): Promise<Metadata> {
  const t = await getTranslations({ locale, namespace: 'faith' });
  return { title: t('metaTitle') };
}

export default async function FaithPage({ params: { locale } }: { params: { locale: string } }) {
  setRequestLocale(locale);

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return redirect({ href: '/login', locale });

  return <FaithClient userId={user.id} />;
}
