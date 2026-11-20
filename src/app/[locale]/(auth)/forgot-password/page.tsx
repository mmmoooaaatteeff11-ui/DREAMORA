import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { ForgotPasswordForm } from '@/components/auth/ForgotPasswordForm';

export async function generateMetadata({ params: { locale } }: { params: { locale: string } }): Promise<Metadata> {
  const t = await getTranslations({ locale, namespace: 'auth.forgot' });
  return { title: t('metaTitle') };
}

export default function ForgotPasswordPage({ params: { locale } }: { params: { locale: string } }) {
  setRequestLocale(locale);
  return <ForgotPasswordForm />;
}
