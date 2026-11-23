import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { MoodQuickCheckIn } from '@/components/mood/MoodCheckIn';
import { Link, redirect } from '@/i18n/navigation';
import { createClient } from '@/lib/supabase/server';

export async function generateMetadata({ params: { locale } }: { params: { locale: string } }): Promise<Metadata> {
  const t = await getTranslations({ locale, namespace: 'dashboard' });
  return { title: t('metaTitle') };
}

function hourIn(timeZone: string): number {
  try {
    const h = Number(new Intl.DateTimeFormat('en-US', { hour: 'numeric', hour12: false, timeZone }).format(new Date()));
    return h % 24;
  } catch {
    return new Date().getUTCHours();
  }
}

function dayPart(hour: number): 'morning' | 'afternoon' | 'evening' | 'night' {
  if (hour >= 5 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 17) return 'afternoon';
  if (hour >= 17 && hour < 21) return 'evening';
  return 'night';
}

function dateLabel(locale: string, timeZone: string): string {
  const tag = locale === 'ar' ? 'ar-EG' : 'en-US';
  try {
    return new Intl.DateTimeFormat(tag, { weekday: 'long', day: 'numeric', month: 'long', timeZone }).format(new Date());
  } catch {
    return new Intl.DateTimeFormat(tag, { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date());
  }
}

const UPCOMING = ['dream', 'mood'] as const;

export default async function DashboardPage({ params: { locale } }: { params: { locale: string } }) {
  setRequestLocale(locale);

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  // Defence in depth: middleware already protects this route.
  if (!user) return redirect({ href: '/login', locale });

  const [{ data: profile }, { data: conversations }] = await Promise.all([
    supabase.from('profiles').select('display_name, timezone').eq('id', user.id).maybeSingle(),
    supabase
      .from('conversations')
      .select('id, title, updated_at')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false })
      .limit(3),
  ]);

  const t = await getTranslations({ locale, namespace: 'dashboard' });
  const timeZone: string = profile?.timezone ?? 'Africa/Cairo';
  const greeting = t(`greeting.${dayPart(hourIn(timeZone))}`);
  const name: string | null = profile?.display_name ?? null;
  const latest = conversations?.[0];

  return (
    <main className="mx-auto w-full max-w-3xl space-y-6 px-4 py-8">
      <header>
        <h1 className="font-heading text-3xl font-semibold">
          {name ? t('greetingWithName', { greeting, name }) : greeting}
        </h1>
        <p className="mt-1 text-muted">{dateLabel(locale, timeZone)}</p>
      </header>

      <Card className="border-primary/30 bg-gradient-to-br from-primary/15 to-transparent">
        <h2 className="font-heading text-xl font-semibold">{t('companionTitle')}</h2>
        <p className="mt-2 text-muted">{t('companionBody')}</p>
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <Link
            href="/companion"
            className="inline-flex h-12 items-center justify-center rounded-pill border border-[#E5E8DF]/60 bg-[#D8DFD3] px-7 font-semibold text-[#26342D] shadow-[0_3px_12px_rgba(0,0,0,0.10)] transition-all duration-200 hover:bg-[#E7EADF] active:scale-[0.98]"
          >
            {t('companionCta')}
          </Link>
          {latest && (
            <Link
              href={`/companion?c=${latest.id}`}
              className="max-w-full truncate text-sm text-primary-light hover:underline"
            >
              {t('continue', { title: latest.title || t('untitled') })}
            </Link>
          )}
        </div>
      </Card>

      <MoodQuickCheckIn />

      <Card className="border-blue-400/20 bg-gradient-to-br from-blue-500/10 to-transparent">
        <h2 className="font-heading text-xl font-semibold">{t('dreamScenesTitle')}</h2>
        <p className="mt-2 text-muted">{t('dreamScenesBody')}</p>
        <Link
          href="/dream-scenes"
          className="mt-5 inline-flex h-12 items-center justify-center rounded-pill border border-glass-border px-6 font-semibold text-primary-light transition hover:bg-white/10"
        >
          {t('dreamScenesCta')}
        </Link>
      </Card>

      <Card className="border-primary/30 bg-gradient-to-br from-primary/15 to-transparent">
        <h2 className="font-heading text-xl font-semibold">{t('faithTitle')}</h2>
        <p className="mt-2 text-muted">{t('faithBody')}</p>
        <Link
          href="/faith"
          className="mt-5 inline-flex h-12 items-center justify-center rounded-pill border border-glass-border px-6 font-semibold text-primary-light transition hover:bg-white/10"
        >
          {t('faithCta')}
        </Link>
      </Card>

      <section aria-labelledby="recent-heading">
        <h2 id="recent-heading" className="mb-3 text-sm font-medium text-muted">
          {t('recent')}
        </h2>
        {conversations && conversations.length > 0 ? (
          <ul className="space-y-2">
            {conversations.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/companion?c=${c.id}`}
                  className="glass block truncate px-4 py-3 text-sm transition hover:bg-white/10"
                >
                  {c.title || t('untitled')}
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="glass px-4 py-3 text-sm text-muted">{t('noConversations')}</p>
        )}
      </section>

      <section aria-labelledby="upcoming-heading">
        <h2 id="upcoming-heading" className="mb-3 text-sm font-medium text-muted">
          {t('upcoming.title')}
        </h2>
        <div className="grid gap-3 sm:grid-cols-3">
          {UPCOMING.map((key) => (
            <div key={key} className="glass p-4">
              <Badge className="mb-3">{t('comingSoon')}</Badge>
              <h3 className="font-medium">{t(`upcoming.${key}.title`)}</h3>
              <p className="mt-1 text-sm text-muted">{t(`upcoming.${key}.body`)}</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
