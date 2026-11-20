import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { PrivacyForm } from '@/components/settings/PrivacyForm';
import { ProfileForm } from '@/components/settings/ProfileForm';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { redirect } from '@/i18n/navigation';
import { createClient } from '@/lib/supabase/server';
import { TIMEZONES } from '@/lib/validation/profile';
import { signOut } from '@/server/services/auth';

export async function generateMetadata({ params: { locale } }: { params: { locale: string } }): Promise<Metadata> {
  const t = await getTranslations({ locale, namespace: 'settings' });
  return { title: t('metaTitle') };
}

export default async function SettingsPage({ params: { locale } }: { params: { locale: string } }) {
  setRequestLocale(locale);

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return redirect({ href: '/login', locale });

  const [{ data: profile }, { data: prefs }, { count: memoryCount }] = await Promise.all([
    supabase.from('profiles').select('display_name, language, timezone, plan').eq('id', user.id).maybeSingle(),
    supabase.from('user_preferences').select('ai_memory_enabled').eq('user_id', user.id).maybeSingle(),
    supabase.from('user_memory').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
  ]);

  const t = await getTranslations({ locale, namespace: 'settings' });
  const plan: string = profile?.plan ?? 'free';

  return (
    <main className="mx-auto w-full max-w-2xl space-y-6 px-4 py-8">
      <header>
        <h1 className="font-heading text-3xl font-semibold">{t('title')}</h1>
        <p className="mt-1 text-muted">{t('subtitle')}</p>
      </header>

      <Card>
        <h2 className="mb-4 font-heading text-xl font-semibold">{t('profile.title')}</h2>
        <ProfileForm
          defaults={{
            displayName: profile?.display_name ?? '',
            language: profile?.language === 'en' ? 'en' : 'ar',
            timezone: profile?.timezone ?? 'Africa/Cairo',
          }}
          timezones={TIMEZONES}
        />
      </Card>

      <Card>
        <h2 className="mb-4 font-heading text-xl font-semibold">{t('privacy.title')}</h2>
        <PrivacyForm enabled={Boolean(prefs?.ai_memory_enabled)} memoryCount={memoryCount ?? 0} />
      </Card>

      <Card>
        <h2 className="mb-4 font-heading text-xl font-semibold">{t('account.title')}</h2>
        <dl className="space-y-3 text-sm">
          <div className="flex items-center justify-between gap-4">
            <dt className="text-muted">{t('account.email')}</dt>
            <dd dir="ltr" className="truncate">
              {user.email}
            </dd>
          </div>
          <div className="flex items-center justify-between gap-4">
            <dt className="text-muted">{t('account.plan')}</dt>
            <dd>
              <Badge tone={plan === 'free' ? 'muted' : 'gold'}>{t(`plans.${plan}`)}</Badge>
            </dd>
          </div>
        </dl>
        <form action={signOut} className="mt-5">
          <Button type="submit" variant="ghost">
            {t('account.signOut')}
          </Button>
        </form>
        <p className="mt-4 text-sm text-muted">{t('soon')}</p>
      </Card>
    </main>
  );
}
