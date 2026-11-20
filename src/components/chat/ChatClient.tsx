'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import { Alert } from '@/components/ui/Alert';
import { useRouter } from '@/i18n/navigation';
import { MAX_MESSAGE_LENGTH } from '@/lib/validation/chat';
import { cn } from '@/lib/utils';

export type ChatMessage = { id: string; role: 'user' | 'assistant'; content: string };

type StreamEvent =
  | { type: 'meta'; conversationId: string }
  | { type: 'delta'; text: string }
  | { type: 'crisis' }
  | { type: 'error'; code: string }
  | { type: 'done' };

const KNOWN_ERRORS = new Set([
  'rate_limited',
  'rate_limit_unavailable',
  'not_configured',
  'service_unavailable',
  'save_failed',
  'upstream',
  'provider_rate_limited',
  'blocked',
  'unauthorized',
  'cancelled',
]);

type FailedAttempt = { text: string; userId: string; assistantId: string };

export function ChatClient({
  conversationId,
  initialMessages,
  locale,
}: {
  conversationId: string | null;
  initialMessages: ChatMessage[];
  locale: 'ar' | 'en';
}) {
  const t = useTranslations('companion');
  const router = useRouter();

  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [retryAttempt, setRetryAttempt] = useState<FailedAttempt | null>(null);

  const convIdRef = useRef<string | null>(conversationId);
  const abortRef = useRef<AbortController | null>(null);
  const sendingRef = useRef(false);
  const counter = useRef(0);
  const messagesRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = messagesRef.current;
    if (container) container.scrollTop = container.scrollHeight;
  }, [messages]);

  useEffect(() => () => abortRef.current?.abort(), []);

  const nextId = () => `local-${++counter.current}`;

  async function send(raw: string, retryOf?: FailedAttempt) {
    const text = raw.trim();
    if (!text || sendingRef.current) return;

    sendingRef.current = true;
    setErrorCode(null);
    setRetryAttempt(null);
    setInput('');
    const userId = retryOf?.userId ?? nextId();
    const assistantId = retryOf?.assistantId ?? nextId();
    setMessages((prev) => [
      ...prev.filter((m) => m.id !== retryOf?.userId && m.id !== retryOf?.assistantId),
      { id: userId, role: 'user', content: text },
      { id: assistantId, role: 'assistant', content: '' },
    ]);
    setStreaming(true);

    const controller = new AbortController();
    abortRef.current = controller;
    const startedNew = convIdRef.current === null;

    const failAttempt = (code: string) => {
      setMessages((prev) => prev.filter((m) => m.id !== assistantId));
      setErrorCode(KNOWN_ERRORS.has(code) ? code : 'generic');
      setInput(text);
      setRetryAttempt({ text, userId, assistantId });
    };

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ message: text, conversationId: convIdRef.current, locale }),
        signal: controller.signal,
      });

      if (!response.ok || !response.body) {
        let code = '';
        try {
          const body: unknown = await response.json();
          if (body && typeof body === 'object' && 'error' in body && typeof body.error === 'string') {
            code = body.error;
          }
        } catch {
          // Use the status fallback when the error response is not JSON.
        }
        if (!KNOWN_ERRORS.has(code)) {
          code = response.status === 401 ? 'unauthorized' : response.status === 429 ? 'rate_limited' : 'generic';
        }
        failAttempt(code);
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let streamError: string | null = null;
      let assistantText = '';

      const handle = (event: StreamEvent) => {
        if (event.type === 'meta') {
          convIdRef.current = event.conversationId;
        } else if (event.type === 'delta') {
          assistantText += event.text;
          setMessages((prev) =>
            prev.map((m) => (m.id === assistantId ? { ...m, content: m.content + event.text } : m)),
          );
        } else if (event.type === 'error') {
          streamError = KNOWN_ERRORS.has(event.code) ? event.code : 'generic';
        }
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split('\n\n');
        buffer = events.pop() ?? '';
        for (const raw of events) {
          const line = raw.split('\n').find((l) => l.startsWith('data: '));
          if (!line) continue;
          try {
            handle(JSON.parse(line.slice(6)) as StreamEvent);
          } catch {
            // ignore malformed event
          }
        }
      }

      if (streamError) {
        failAttempt(streamError);
        return;
      }
      if (!assistantText.trim()) {
        failAttempt('generic');
        return;
      }

      // New conversation: move to its own URL (the server page then loads the saved messages).
      if (startedNew && convIdRef.current) router.replace(`/companion?c=${convIdRef.current}`);
      else router.refresh();
    } catch (error) {
      const aborted = (error as { name?: string }).name === 'AbortError';
      failAttempt(aborted ? 'cancelled' : 'generic');
    } finally {
      setStreaming(false);
      sendingRef.current = false;
      abortRef.current = null;
    }
  }

  const suggestions = [t('empty.s1'), t('empty.s2'), t('empty.s3')];

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div ref={messagesRef} className="min-h-0 flex-1 space-y-4 overflow-y-auto px-1 py-2" aria-live="polite">
        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-5 text-center">
            <div>
              <h2 className="font-heading text-2xl font-semibold">{t('empty.title')}</h2>
              <p className="mt-2 text-muted">{t('empty.body')}</p>
            </div>
            <div className="flex max-w-md flex-col gap-2">
              {suggestions.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => send(s)}
                  className="glass px-4 py-3 text-sm transition hover:bg-white/10"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((m) => (
            <div key={m.id} className={cn('flex', m.role === 'user' ? 'justify-end' : 'justify-start')}>
              <div
                className={cn(
                  'max-w-[85%] whitespace-pre-wrap break-words rounded-2xl px-4 py-3 text-[15px] leading-relaxed',
                  m.role === 'user' ? 'bg-primary/25 text-ink' : 'glass',
                )}
              >
                <span className="sr-only">{m.role === 'user' ? t('you') : t('assistant')}: </span>
                <span dir="auto">{m.content || (streaming ? t('typing') : '')}</span>
              </div>
            </div>
          ))
        )}
      </div>

      {errorCode && (
        <div className="mb-3 flex items-center gap-3">
          <Alert className="min-w-0 flex-1">{t(`errors.${errorCode}`)}</Alert>
          {retryAttempt && (
            <button
              type="button"
              onClick={() => void send(retryAttempt.text, retryAttempt)}
              className="shrink-0 rounded-pill border border-glass-border px-4 py-2 text-sm text-primary-light transition hover:bg-white/10"
            >
              {t('retry')}
            </button>
          )}
        </div>
      )}

      <form
        onSubmit={(event) => {
          event.preventDefault();
          void send(input);
        }}
        className="glass flex items-end gap-2 p-2"
      >
        <label htmlFor="chat-input" className="sr-only">
          {t('placeholder')}
        </label>
        <textarea
          id="chat-input"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
              event.preventDefault();
              void send(input);
            }
          }}
          rows={2}
          maxLength={MAX_MESSAGE_LENGTH}
          placeholder={t('placeholder')}
          dir="auto"
          className="max-h-40 min-h-[3rem] flex-1 resize-none bg-transparent px-3 py-2 text-ink outline-none placeholder:text-muted/70"
        />
        {streaming ? (
          <button
            type="button"
            onClick={() => abortRef.current?.abort()}
            className="h-11 shrink-0 rounded-pill border border-glass-border px-5 text-sm transition hover:bg-white/10"
          >
            {t('stop')}
          </button>
        ) : (
          <button
            type="submit"
            disabled={input.trim().length === 0}
            className="h-11 shrink-0 rounded-pill bg-gradient-to-r from-[#6D28D9] to-primary px-5 text-sm font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {t('send')}
          </button>
        )}
      </form>
      <p className="mt-2 px-1 text-xs text-muted">{t('disclaimer')}</p>
    </div>
  );
}
