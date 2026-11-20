import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { z } from 'zod';
import { ChatClient, type ChatMessage } from '@/components/chat/ChatClient';
import { ConversationList } from '@/components/chat/ConversationList';
import { redirect } from '@/i18n/navigation';
import { createClient } from '@/lib/supabase/server';

export async function generateMetadata({ params: { locale } }: { params: { locale: string } }): Promise<Metadata> {
  const t = await getTranslations({ locale, namespace: 'companion' });
  return { title: t('metaTitle') };
}

export default async function CompanionPage({
  params: { locale },
  searchParams,
}: {
  params: { locale: string };
  searchParams: { c?: string };
}) {
  setRequestLocale(locale);

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return redirect({ href: '/login', locale });

  const { data: conversations } = await supabase
    .from('conversations')
    .select('id, title')
    .eq('user_id', user.id)
    .order('updated_at', { ascending: false })
    .limit(30);

  // Open a conversation only if the id is a UUID that belongs to this user (RLS + explicit filter).
  let activeId: string | null = null;
  let initialMessages: ChatMessage[] = [];
  const requested = z.string().uuid().safeParse(searchParams.c);
  if (requested.success) {
    const { data: conversation } = await supabase
      .from('conversations')
      .select('id')
      .eq('id', requested.data)
      .eq('user_id', user.id)
      .maybeSingle();

    if (conversation) {
      activeId = conversation.id;
      const { data: rows } = await supabase
        .from('messages')
        .select('id, role, content')
        .eq('user_id', user.id)
        .eq('conversation_id', conversation.id)
        .order('created_at', { ascending: true })
        .limit(200);
      initialMessages = (rows ?? []).map((row: { id: string; role: string; content: string }) => ({
        id: row.id,
        role: row.role === 'assistant' ? 'assistant' : 'user',
        content: row.content,
      }));
    }
  }

  const t = await getTranslations({ locale, namespace: 'companion' });
  const list = (
    <ConversationList conversations={conversations ?? []} activeId={activeId} />
  );

  return (
    <main className="mx-auto flex h-[calc(100dvh-7.5rem)] w-full min-w-0 max-w-5xl gap-6 overflow-hidden p-4 lg:h-dvh lg:p-6">
      <aside className="hidden w-64 shrink-0 flex-col xl:flex">{list}</aside>

      <section className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <details className="glass mb-3 max-h-64 shrink-0 overflow-hidden xl:hidden">
          <summary className="cursor-pointer px-4 py-3 text-sm">{t('history')}</summary>
          <div className="max-h-56 overflow-y-auto p-3">{list}</div>
        </details>

        {/* key: switching conversation remounts the chat with that conversation's saved messages */}
        <ChatClient
          key={activeId ?? 'new'}
          conversationId={activeId}
          initialMessages={initialMessages}
          locale={locale === 'en' ? 'en' : 'ar'}
        />
      </section>
    </main>
  );
}
