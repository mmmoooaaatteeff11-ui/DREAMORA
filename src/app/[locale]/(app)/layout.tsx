import { setRequestLocale } from 'next-intl/server';
import { AppNav } from '@/components/layout/AppNav';

/** Shell for every signed-in page. Auth itself is enforced by middleware and again in each page. */
export default function AppLayout({
  children,
  params: { locale },
}: {
  children: React.ReactNode;
  params: { locale: string };
}) {
  setRequestLocale(locale);

  return (
    <div className="min-h-dvh min-w-0 lg:flex">
      <AppNav />
      <div className="min-w-0 pb-16 lg:flex-1 lg:pb-0">{children}</div>
    </div>
  );
}
