import { setRequestLocale } from 'next-intl/server';
import { LocaleSwitcher } from '@/components/layout/LocaleSwitcher';
import { Link } from '@/i18n/navigation';

export default function AuthLayout({
  children,
  params: { locale },
}: {
  children: React.ReactNode;
  params: { locale: string };
}) {
  setRequestLocale(locale);

  return (
    <main className="relative flex min-h-dvh flex-col items-center justify-center px-4 py-16">
      <div className="absolute end-4 top-4">
        <LocaleSwitcher />
      </div>

      <Link
        href="/login"
        dir="ltr"
        className="mb-8 bg-gradient-to-r from-primary to-primary-light bg-clip-text font-heading text-3xl font-semibold tracking-[0.3em] text-transparent"
      >
        DREAMORA
      </Link>

      <div className="w-full max-w-md">{children}</div>
    </main>
  );
}
