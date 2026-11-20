'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useTransition } from 'react';
import { usePathname, useRouter } from '@/i18n/navigation';

export function LocaleSwitcher() {
  const t = useTranslations('common');
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();

  const target = locale === 'ar' ? 'en' : 'ar';

  return (
    <button
      type="button"
      lang={target}
      aria-label={t('language')}
      disabled={pending}
      onClick={() => startTransition(() => router.replace(pathname, { locale: target }))}
      className="glass rounded-pill px-4 py-2 text-sm text-ink transition hover:bg-white/10 disabled:opacity-60"
    >
      {target === 'ar' ? 'العربية' : 'English'}
    </button>
  );
}
