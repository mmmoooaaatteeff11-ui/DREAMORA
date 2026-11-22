import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Card } from '@/components/ui/Card';
import { Link, redirect } from '@/i18n/navigation';
import { createClient } from '@/lib/supabase/server';

const JOURNEY_ITEMS = [
  { href: '/mood', key: 'mood', icon: 'mood' },
  { href: '/journal', key: 'journal', icon: 'journal' },
  { href: '/letters', key: 'letters', icon: 'letters' },
  { href: '/roadmap', key: 'roadmap', icon: 'roadmap' },
  { href: '/vision', key: 'vision', icon: 'vision' },
  { href: '/dream-scenes', key: 'dreamScenes', icon: 'dreamScenes' },
] as const;

type JourneyIconName = (typeof JOURNEY_ITEMS)[number]['icon'];

function JourneyIcon({ name }: { name: JourneyIconName }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="h-6 w-6"
    >
      {name === 'mood' && (
        <>
          <circle cx="12" cy="12" r="9" />
          <path d="M8 14s1.5 2 4 2 4-2 4-2" />
          <path d="M9 9h.01M15 9h.01" />
        </>
      )}
      {name === 'journal' && (
        <>
          <path d="M6 3.75h8l4 4V20a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4.75a1 1 0 0 1 1-1Z" />
          <path d="M14 4v4h4M8 12h8M8 16h8" />
        </>
      )}
      {name === 'letters' && (
        <>
          <rect x="3" y="5" width="18" height="14" rx="2" />
          <path d="m4 7 8 6 8-6" />
        </>
      )}
      {name === 'roadmap' && (
        <>
          <path d="M5 19c0-4 5-4 5-8s-5-4-5-8M19 19c0-4-5-4-5-8s5-4 5-8" />
          <circle cx="5" cy="3" r="1" />
          <circle cx="19" cy="21" r="1" />
        </>
      )}
      {name === 'vision' && (
        <>
          <path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" />
          <circle cx="12" cy="12" r="2.5" />
        </>
      )}
      {name === 'dreamScenes' && (
        <>
          <path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.64 5.64l2.12 2.12M16.24 16.24l2.12 2.12M18.36 5.64l-2.12 2.12M7.76 16.24l-2.12 2.12" />
          <circle cx="12" cy="12" r="4" />
        </>
      )}
    </svg>
  );
}

export async function generateMetadata({
  params: { locale },
}: {
  params: { locale: string };
}): Promise<Metadata> {
  const t = await getTranslations({ locale, namespace: 'journey' });
  return { title: t('metaTitle') };
}

export default async function JourneyPage({ params: { locale } }: { params: { locale: string } }) {
  setRequestLocale(locale);

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return redirect({ href: '/login', locale });

  const t = await getTranslations('journey');

  return (
    <main className="mx-auto w-full max-w-5xl space-y-6 px-4 py-8">
      <header className="space-y-2">
        <h1 className="font-heading text-3xl font-semibold sm:text-4xl">{t('title')}</h1>
        <p className="max-w-2xl text-muted">{t('description')}</p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {JOURNEY_ITEMS.map(({ href, key, icon }) => (
          <Link
            href={href}
            key={key}
            className="group block rounded-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-light"
          >
            <Card className="h-full transition-colors group-hover:border-primary/40 group-hover:bg-white/[0.07]">
              <span className="mb-5 grid h-12 w-12 place-items-center rounded-xl bg-primary/15 text-primary-light">
                <JourneyIcon name={icon} />
              </span>
              <h2 className="font-heading text-xl font-semibold">{t(`cards.${key}.title`)}</h2>
              <p className="mt-2 text-sm leading-6 text-muted">{t(`cards.${key}.description`)}</p>
            </Card>
          </Link>
        ))}
      </div>
    </main>
  );
}
