
'use client';

import { useTranslations } from 'next-intl';
import { Mic } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Alert } from '@/components/ui/Alert';
import { VoiceConversation } from '@/components/chat/VoiceConversation';
import { useRouter } from '@/i18n/navigation';
import { MAX_MESSAGE_LENGTH } from '@/lib/validation/chat';
import { MAX_VOICE_AUDIO_BYTES, type VoiceLanguage } from '@/lib/validation/voice';
import { cn } from '@/lib/utils';

export type ChatMessage = { id: string; role: 'user' | 'assistant'; content: string };

type StreamEvent =
  | { type: 'meta'; conversationId: string }
  | { type: 'delta'; text: string }
  | { type: 'audio'; data: string; mimeType: 'audio/wav' }
  | { type: 'voice_error'; code: string }
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
  'insufficient_credits',
  'quota_exhausted_no_credits',
  'plan_required',
]);

type FailedAttempt = { text: string; userId: string; assistantId: string };
type VoiceTurnResponse = { text: string; audioData: string | null; voiceError: string | null };
type SendOptions = {
  voice?: boolean;
  voiceLanguage?: VoiceLanguage;
  onDelta?: (text: string) => void;
  onError?: (code: string) => void;
};

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
  const [voiceMode, setVoiceMode] = useState(false);

  const convIdRef = useRef<string | null>(conversationId);
  const abortRef = useRef<AbortController | null>(null);
  const sendingRef = useRef(false);
  const voiceModeRef = useRef(false);
  const pendingVoiceConversationRef = useRef<string | null>(null);
  const counter = useRef(0);
  const messagesRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = messagesRef.current;
    if (container) container.scrollTop = container.scrollHeight;
  }, [messages]);

  useEffect(() => () => abortRef.current?.abort(), []);

  const nextId = () => `local-${++counter.current}`;

  async function send(
    raw: string,
    retryOf?: FailedAttempt,
    options: SendOptions = {},
  ): Promise<VoiceTurnResponse | null> {
    const text = raw.trim();
    if (!text || sendingRef.current) return null;

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
    const requestId = crypto.randomUUID();

    const failAttempt = (code: string) => {
      setMessages((prev) => prev.filter((m) => m.id !== assistantId));
      const normalizedCode = KNOWN_ERRORS.has(code) ? code : 'generic';
      setErrorCode(normalizedCode);
      setInput(text);
      setRetryAttempt({ text, userId, assistantId });
      options.onError?.(normalizedCode);
    };

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          message: text,
          conversationId: convIdRef.current,
          locale,
          requestId,
          voice: options.voice ?? false,
          voiceConsent: options.voice ?? false,
          voiceLanguage: options.voiceLanguage ?? 'auto',
        }),
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
        return null;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let streamError: string | null = null;
      let assistantText = '';
      let audioData: string | null = null;
      let voiceError: string | null = null;

      const handle = (event: StreamEvent) => {
        if (event.type === 'meta') {
          convIdRef.current = event.conversationId;
          if (options.voice && startedNew) {
            pendingVoiceConversationRef.current = event.conversationId;
            if (!voiceModeRef.current) {
              pendingVoiceConversationRef.current = null;
              router.replace(`/companion?c=${event.conversationId}`);
            }
          }
        } else if (event.type === 'delta') {
          assistantText += event.text;
          setMessages((prev) =>
            prev.map((m) => (m.id === assistantId ? { ...m, content: m.content + event.text } : m)),
          );
          options.onDelta?.(assistantText);
        } else if (event.type === 'audio') {
          if (event.data.length <= Math.ceil((MAX_VOICE_AUDIO_BYTES * 4) / 3) + 8) audioData = event.data;
          else voiceError = 'audio_too_large';
        } else if (event.type === 'voice_error') {
          voiceError = event.code;
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
        return null;
      }
      if (!assistantText.trim()) {
        failAttempt('generic');
        return null;
      }

      if (options.voice) {
        if (!voiceModeRef.current) {
          const pendingId = pendingVoiceConversationRef.current;
          if (pendingId) {
            pendingVoiceConversationRef.current = null;
            router.replace(`/companion?c=${pendingId}`);
          } else {
            router.refresh();
          }
        }
      } else if (startedNew && convIdRef.current) {
        router.replace(`/companion?c=${convIdRef.current}`);
      } else {
        router.refresh();
      }

      return { text: assistantText, audioData, voiceError };
    } catch (error) {
      const aborted = (error as { name?: string }).name === 'AbortError';
      failAttempt(aborted ? 'cancelled' : 'generic');
      return null;
    } finally {
      setStreaming(false);
      sendingRef.current = false;
      abortRef.current = null;
    }
  }

  async function sendVoiceMessage(
    text: string,
    language: VoiceLanguage,
    onDelta: (text: string) => void,
    onError: (message: string) => void,
  ) {
    return send(text, undefined, {
      voice: true,
      voiceLanguage: language,
      onDelta,
      onError: (code) => onError(KNOWN_ERRORS.has(code) ? t(`errors.${code}`) : t('voice.errors.chatFailed')),
    });
  }

  function closeVoiceMode() {
    voiceModeRef.current = false;
    setVoiceMode(false);
    const pendingId = pendingVoiceConversationRef.current;
    if (pendingId) {
      pendingVoiceConversationRef.current = null;
      router.replace(`/companion?c=${pendingId}`);
    } else if (convIdRef.current) {
      router.refresh();
    }
  }

  function settleVoiceTurn() {
    const pendingId = pendingVoiceConversationRef.current;
    if (pendingId && !voiceModeRef.current) {
      pendingVoiceConversationRef.current = null;
      router.replace(`/companion?c=${pendingId}`);
    } else if (!pendingId) {
      router.refresh();
    }
  }

  const suggestions = [t('empty.s1'), t('empty.s2'), t('empty.s3')];

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {voiceMode ? (
        <VoiceConversation
          locale={locale}
          onClose={closeVoiceMode}
          onInterruptResponse={() => abortRef.current?.abort()}
          onSend={sendVoiceMessage}
          onTurnSettled={settleVoiceTurn}
        />
      ) : (
        <>
          <div
            ref={messagesRef}
            className="min-h-0 flex-1 space-y-4 overflow-y-auto px-1 py-2"
            aria-live="polite"
          >
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
                      onClick={() => void send(s)}
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

          <div className="mb-2 flex justify-end">
            <button
              type="button"
              onClick={() => {
                voiceModeRef.current = true;
                setVoiceMode(true);
              }}
              disabled={streaming}
              className="inline-flex min-h-10 items-center gap-2 rounded-full border border-glass-border px-4 text-sm text-primary-light transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Mic className="h-4 w-4" aria-hidden="true" />
              {t('voice.open')}
            </button>
          </div>

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
        </>
      )}

      {/* Developer Credit */}
      <footer
        className="shrink-0 border-t border-glass-border/40 py-3 text-center"
        dir={locale === 'ar' ? 'rtl' : 'ltr'}
      >
        <p className="text-[11px] tracking-wide text-muted/70">
          {locale === 'ar' ? 'تم تطوير هذا الموقع بواسطة' : 'Developed by'}
          {' '}
          <span className="font-semibold text-primary-light">
            Mohamed Atef
          </span>
          <span className="mx-2 text-muted/50">✦</span>
          <span className="text-muted/60">Dreamora</span>
        </p>
      </footer>
    </div>
  );
}
