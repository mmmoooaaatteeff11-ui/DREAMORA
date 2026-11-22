'use client';

import { useTranslations } from 'next-intl';
import { LocaleSwitcher } from '@/components/layout/LocaleSwitcher';
import { Link, usePathname } from '@/i18n/navigation';
import { cn } from '@/lib/utils';
import { signOut } from '@/server/services/auth';

type IconProps = { className?: string };

function Svg({ className, children }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      {children}
    </svg>
  );
}

const HomeIcon = ({ className }: IconProps) => (
  <Svg className={className}>
    <path d="M3 11.5 12 4l9 7.5" />
    <path d="M5 10v9a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1v-9" />
  </Svg>
);
const ChatIcon = ({ className }: IconProps) => (
  <Svg className={className}>
    <path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12Z" />
  </Svg>
);
const DreamIcon = ({ className }: IconProps) => (
  <Svg className={className}>
    <path d="M12 3v2" />
    <path d="M4.93 4.93 6.34 6.34" />
    <path d="M3 12h2" />
    <path d="M19 12h2" />
    <path d="m17.66 6.34 1.41-1.41" />
    <path d="M7 17a5 5 0 1 1 10 0c0 1.2-.5 2.2-1.5 3H8.5C7.5 19.2 7 18.2 7 17Z" />
    <path d="M9 22h6" />
  </Svg>
);
const MoonIcon = ({ className }: IconProps) => (
  <Svg className={className}>
    <path d="M20.2 15.1A8.5 8.5 0 0 1 8.9 3.8 8.5 8.5 0 1 0 20.2 15.1Z" />
    <path d="m16 3 .5 1.5L18 5l-1.5.5L16 7l-.5-1.5L14 5l1.5-.5L16 3Z" />
  </Svg>
);
const GearIcon = ({ className }: IconProps) => (
  <Svg className={className}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3h0a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5h0a1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9v0a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" />
  </Svg>
);

const ITEMS = [
  { href: '/dashboard', key: 'dashboard', Icon: HomeIcon },
  { href: '/companion', key: 'companion', Icon: ChatIcon },
  { href: '/faith', key: 'faith', Icon: MoonIcon },
  { href: '/journey', key: 'journey', Icon: DreamIcon },
  { href: '/settings', key: 'settings', Icon: GearIcon },
] as const;

const JOURNEY_PATHS = ['/journey', '/mood', '/journal', '/letters', '/roadmap', '/vision', '/dream-scenes'] as const;

function isActive(pathname: string, href: string) {
  if (href === '/journey' && JOURNEY_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`))) {
    return true;
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

function Logo() {
  return (
    <Link
      href="/dashboard"
      dir="ltr"
      className="bg-gradient-to-r from-primary to-primary-light bg-clip-text font-heading text-xl font-semibold tracking-[0.3em] text-transparent"
    >
      DREAMORA
    </Link>
  );
}

export function AppNav() {
  const t = useTranslations('nav');
  const tc = useTranslations('common');
  const pathname = usePathname();

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col gap-6 border-e border-glass-border p-5 lg:flex">
        <Logo />
        <nav aria-label={t('label')} className="flex flex-1 flex-col gap-1">
          {ITEMS.map(({ href, key, Icon }) => {
            const active = isActive(pathname, href);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors',
                  active ? 'bg-primary/20 text-ink' : 'text-muted hover:bg-white/5 hover:text-ink',
                )}
              >
                <Icon className="h-5 w-5" />
                {t(key)}
              </Link>
            );
          })}
        </nav>
        <div className="flex items-center justify-between gap-2">
          <LocaleSwitcher />
          <form action={signOut}>
            <button type="submit" className="rounded-pill px-3 py-2 text-sm text-muted transition hover:text-ink">
              {tc('signOut')}
            </button>
          </form>
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-glass-border bg-base/70 px-4 backdrop-blur-xl lg:hidden">
        <Logo />
        <LocaleSwitcher />
      </header>

      {/* Mobile bottom navigation */}
      <nav
        aria-label={t('label')}
        className="fixed inset-x-0 bottom-0 z-30 flex h-16 border-t border-glass-border bg-base/85 backdrop-blur-xl lg:hidden"
      >
        {ITEMS.map(({ href, key, Icon }) => {
          const active = isActive(pathname, href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'flex flex-1 flex-col items-center justify-center gap-1 text-xs transition-colors',
                active ? 'text-primary-light' : 'text-muted',
              )}
            >
              <Icon className="h-5 w-5" />
              {t(key)}
            </Link>
          );
        })}
      </nav>
    </>
  );
}
