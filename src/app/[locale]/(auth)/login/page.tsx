import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { LoginForm } from '@/components/auth/LoginForm';
import { sanitizeInternalPath } from '@/lib/auth/redirect';

export async function generateMetadata({ params: { locale } }: { params: { locale: string } }): Promise<Metadata> {
  const t = await getTranslations({ locale, namespace: 'auth.login' });
  return { title: t('metaTitle') };
}

export default function LoginPage({
  params: { locale },
  searchParams,
}: {
  params: { locale: string };
  searchParams: { next?: string; error?: string };
}) {
  setRequestLocale(locale);
  const next = sanitizeInternalPath(searchParams.next) ?? undefined;
  return <LoginForm next={next} callbackError={searchParams.error === 'auth_callback'} />;
}
