import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { SignupForm } from '@/components/auth/SignupForm';

export async function generateMetadata({ params: { locale } }: { params: { locale: string } }): Promise<Metadata> {
  const t = await getTranslations({ locale, namespace: 'auth.signup' });
  return { title: t('metaTitle') };
}

export default function SignupPage({ params: { locale } }: { params: { locale: string } }) {
  setRequestLocale(locale);
  return <SignupForm />;
}
