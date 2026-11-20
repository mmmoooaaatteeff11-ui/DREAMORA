import { getTranslations } from 'next-intl/server';
import { ConfirmSubmitButton } from '@/components/ui/ConfirmSubmitButton';
import { Link } from '@/i18n/navigation';
import { cn } from '@/lib/utils';
import { deleteConversation } from '@/server/services/chat';

export type ConversationItem = { id: string; title: string | null };

export async function ConversationList({
  conversations,
  activeId,
}: {
  conversations: ConversationItem[];
  activeId: string | null;
}) {
  const t = await getTranslations('companion');
  const td = await getTranslations('dashboard');

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <Link
        href="/companion"
        className="inline-flex h-11 items-center justify-center rounded-pill bg-gradient-to-r from-[#6D28D9] to-primary px-5 text-sm font-semibold text-white shadow-glow transition hover:brightness-110"
      >
        {t('newChat')}
      </Link>

      {conversations.length === 0 ? (
        <p className="px-1 text-sm text-muted">{t('noHistory')}</p>
      ) : (
        <ul className="min-h-0 flex-1 space-y-1 overflow-y-auto">
          {conversations.map((c) => (
            <li
              key={c.id}
              className={cn(
                'group flex items-center gap-1 rounded-xl pe-1 transition-colors',
                c.id === activeId ? 'bg-primary/20' : 'hover:bg-white/5',
              )}
            >
              <Link
                href={`/companion?c=${c.id}`}
                aria-current={c.id === activeId ? 'page' : undefined}
                className="min-w-0 flex-1 truncate px-3 py-2.5 text-sm"
              >
                {c.title || td('untitled')}
              </Link>
              <form action={deleteConversation}>
                <input type="hidden" name="id" value={c.id} />
                <ConfirmSubmitButton
                  confirmText={t('deleteConfirm')}
                  aria-label={t('deleteConversation')}
                  title={t('deleteConversation')}
                  className="rounded-lg p-2 text-muted transition hover:text-red-300"
                >
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={1.8}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                    className="h-4 w-4"
                  >
                    <path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14M10 10v6M14 10v6" />
                  </svg>
                </ConfirmSubmitButton>
              </form>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
