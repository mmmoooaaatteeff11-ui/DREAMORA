import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { ResetPasswordForm } from '@/components/auth/ResetPasswordForm';
import { Alert } from '@/components/ui/Alert';
import { Card } from '@/components/ui/Card';
import { Link } from '@/i18n/navigation';
import { createClient } from '@/lib/supabase/server';

export async function generateMetadata({ params: { locale } }: { params: { locale: string } }): Promise<Metadata> {
  const t = await getTranslations({ locale, namespace: 'auth.reset' });
  return { title: t('metaTitle') };
}

export default async function ResetPasswordPage({ params: { locale } }: { params: { locale: string } }) {
  setRequestLocale(locale);

  // The recovery link (/auth/callback) must have created a session; otherwise the link is invalid/expired.
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const t = await getTranslations({ locale, namespace: 'auth.reset' });
    return (
      <Card>
        <h1 className="font-heading text-2xl font-semibold">{t('expiredTitle')}</h1>
        <Alert className="mt-5">{t('expiredBody')}</Alert>
        <p className="mt-6 text-center text-sm">
          <Link href="/forgot-password" className="font-medium text-primary-light hover:underline">
            {t('requestNew')}
          </Link>
        </p>
      </Card>
    );
  }

  return <ResetPasswordForm />;
}
