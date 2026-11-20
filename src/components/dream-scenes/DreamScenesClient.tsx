'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import { Alert } from '@/components/ui/Alert';
import { Card } from '@/components/ui/Card';
import { Link, useRouter } from '@/i18n/navigation';

export type SavedDreamScene = {
  id?: string;
  runId: string;
  sceneNumber: number;
  dream: string;
  sceneText: string;
  choices: string[];
  firstStep: string;
  createdAt: string;
};

type SceneEvent =
  | { type: 'delta'; text: string }
  | {
      type: 'complete';
      runId: string;
      sceneNumber: number;
      sceneText: string;
      choices: string[];
      firstStep: string;
    }
  | { type: 'crisis'; text: string }
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
  'invalid_output',
  'unauthorized',
  'not_found',
]);

export function DreamScenesClient({
  locale,
  initialScene,
  sessions,
  loadError,
  runNotFound,
}: {
  locale: 'ar' | 'en';
  initialScene: SavedDreamScene | null;
  sessions: SavedDreamScene[];
  loadError: boolean;
  runNotFound: boolean;
}) {
  const t = useTranslations('dreamScenes');
  const router = useRouter();
  const [scene, setScene] = useState(initialScene);
  const [goal, setGoal] = useState('');
  const [choice, setChoice] = useState('');
  const [pendingText, setPendingText] = useState('');
  const [busy, setBusy] = useState(false);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [crisisMessage, setCrisisMessage] = useState<string | null>(null);
  const busyRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    setScene(initialScene);
    setChoice('');
  }, [initialScene]);

  useEffect(() => () => abortRef.current?.abort(), []);

  async function submit(action: 'start' | 'continue') {
    if (busyRef.current) return;
    const text = action === 'start' ? goal.trim() : choice.trim();
    if (!text) return;

    busyRef.current = true;
    setBusy(true);
    setErrorCode(null);
    setCrisisMessage(null);
    setPendingText('');
    const controller = new AbortController();
    abortRef.current = controller;

    let completed = false;
    let streamError: string | null = null;
    let receivedCrisis = false;

    try {
      const body =
        action === 'start'
          ? { action, goal: text, locale }
          : { action, runId: scene?.runId, choice: text, locale };
      const response = await fetch('/api/dream-scenes', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!response.ok || !response.body) {
        let code = '';
        try {
          const errorBody: unknown = await response.json();
          if (
            errorBody &&
            typeof errorBody === 'object' &&
            'error' in errorBody &&
            typeof errorBody.error === 'string'
          ) {
            code = errorBody.error;
          }
        } catch {
          // Use the status fallback when the error response is not JSON.
        }
        if (!KNOWN_ERRORS.has(code)) {
          code =
            response.status === 401
              ? 'unauthorized'
              : response.status === 429
                ? 'rate_limited'
                : 'service_unavailable';
        }
        streamError = code;
      } else {
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        const handle = (event: SceneEvent) => {
          if (event.type === 'delta') {
            setPendingText((current) => current + event.text);
          } else if (event.type === 'complete') {
            completed = true;
            setScene({
              runId: event.runId,
              sceneNumber: event.sceneNumber,
              dream: action === 'start' ? text : scene?.dream ?? '',
              sceneText: event.sceneText,
              choices: event.choices,
              firstStep: event.firstStep,
              createdAt: new Date().toISOString(),
            });
            setPendingText('');
            setChoice('');
            setGoal('');
            router.replace(`/dream-scenes?run=${event.runId}`);
          } else if (event.type === 'crisis') {
            receivedCrisis = true;
            setScene(null);
            setPendingText('');
            setGoal('');
            setChoice('');
            setCrisisMessage(event.text);
            router.replace('/dream-scenes');
          } else if (event.type === 'error') {
            streamError = KNOWN_ERRORS.has(event.code) ? event.code : 'upstream';
          }
        };

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const events = buffer.split('\n\n');
          buffer = events.pop() ?? '';
          for (const raw of events) {
            const line = raw.split('\n').find((entry) => entry.startsWith('data: '));
            if (!line) continue;
            try {
              handle(JSON.parse(line.slice(6)) as SceneEvent);
            } catch {
              // Ignore malformed server-sent events.
            }
          }
        }
      }

      if (streamError) setErrorCode(streamError);
      else if (!completed && !receivedCrisis) setErrorCode('upstream');
    } catch (error) {
      if ((error as { name?: string }).name !== 'AbortError') setErrorCode('upstream');
    } finally {
      setBusy(false);
      busyRef.current = false;
      abortRef.current = null;
    }
  }

  function startNewScene() {
    if (busyRef.current) return;
    setScene(null);
    setGoal('');
    setChoice('');
    setPendingText('');
    setCrisisMessage(null);
    setErrorCode(null);
    router.replace('/dream-scenes');
  }

  const activeRunId = scene?.runId;
  const displayedSessions = sessions.filter((session) => session.runId !== activeRunId);

  return (
    <main className="mx-auto w-full max-w-3xl space-y-5 px-4 py-6 sm:py-10">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-semibold sm:text-3xl">{t('title')}</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted">{t('subtitle')}</p>
        </div>
        <Link
          href="/dashboard"
          className="shrink-0 rounded-pill border border-glass-border px-4 py-2 text-sm text-muted transition hover:bg-white/10 hover:text-ink"
        >
          {t('exit')}
        </Link>
      </header>

      <p className="text-xs text-muted">{t('note')}</p>

      {loadError && <Alert>{t('errors.load_failed')}</Alert>}
      {runNotFound && <Alert>{t('errors.not_found')}</Alert>}
      {errorCode && <Alert>{t(`errors.${errorCode}`)}</Alert>}
      {crisisMessage && (
        <Card className="border-red-300/30 bg-red-950/30">
          <p className="whitespace-pre-line leading-relaxed">{crisisMessage}</p>
        </Card>
      )}

      {!crisisMessage && scene && (
        <Card className="border-primary/30 bg-gradient-to-br from-primary/15 via-transparent to-blue-500/5">
          <p className="mb-4 text-xs uppercase tracking-wide text-primary-light">
            {t('sceneNumber', { number: scene.sceneNumber })}
          </p>
          <p className="whitespace-pre-line text-base leading-8 text-ink sm:text-lg">{scene.sceneText}</p>
          <div className="mt-6 rounded-xl border border-primary/20 bg-primary/10 p-4">
            <h2 className="text-sm font-semibold text-primary-light">{t('firstStep')}</h2>
            <p className="mt-2 leading-relaxed">{scene.firstStep}</p>
          </div>
        </Card>
      )}

      {busy && pendingText && (
        <Card aria-live="polite" className="border-primary/30 bg-gradient-to-br from-primary/15 via-transparent to-blue-500/5">
          <p className="whitespace-pre-line text-base leading-8 text-ink sm:text-lg">{pendingText}</p>
        </Card>
      )}

      {!crisisMessage && !scene && !busy && (
        <Card>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void submit('start');
            }}
            className="space-y-4"
          >
            <label htmlFor="dream-goal" className="block text-sm font-medium">
              {t('goalLabel')}
            </label>
            <textarea
              id="dream-goal"
              value={goal}
              onChange={(event) => setGoal(event.target.value)}
              maxLength={2000}
              rows={3}
              dir="auto"
              placeholder={t('goalPlaceholder')}
              className="w-full resize-y rounded-xl border border-glass-border bg-white/5 px-4 py-3 text-ink outline-none transition focus:border-primary/60"
            />
            <button
              type="submit"
              disabled={!goal.trim() || busy}
              className="rounded-pill bg-gradient-to-r from-[#6D28D9] to-primary px-6 py-3 font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy ? t('generating') : t('start')}
            </button>
          </form>
        </Card>
      )}

      {scene && !crisisMessage && (
        <Card>
          <h2 className="mb-3 text-sm font-semibold">{t('chooseNext')}</h2>
          <div className="mb-4 flex flex-wrap gap-2">
            {scene.choices.map((option) => (
              <button
                key={option}
                type="button"
                disabled={busy}
                aria-pressed={choice === option}
                onClick={() => setChoice(option)}
                className="rounded-pill border border-glass-border px-4 py-2 text-start text-sm transition hover:bg-white/10 aria-pressed:border-primary aria-pressed:bg-primary/15 disabled:opacity-50"
              >
                {option}
              </button>
            ))}
          </div>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void submit('continue');
            }}
            className="space-y-3"
          >
            <label htmlFor="scene-choice" className="sr-only">
              {t('choiceLabel')}
            </label>
            <textarea
              id="scene-choice"
              value={choice}
              onChange={(event) => setChoice(event.target.value)}
              maxLength={1000}
              rows={2}
              dir="auto"
              placeholder={t('choicePlaceholder')}
              className="w-full resize-y rounded-xl border border-glass-border bg-white/5 px-4 py-3 text-ink outline-none transition focus:border-primary/60"
            />
            <div className="flex flex-wrap gap-3">
              <button
                type="submit"
                disabled={!choice.trim() || busy}
                className="rounded-pill bg-gradient-to-r from-[#6D28D9] to-primary px-6 py-3 font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {busy ? t('generating') : t('continue')}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={startNewScene}
                className="rounded-pill border border-glass-border px-5 py-3 text-sm text-muted transition hover:bg-white/10 hover:text-ink disabled:opacity-50"
              >
                {t('newScene')}
              </button>
            </div>
          </form>
        </Card>
      )}

      {displayedSessions.length > 0 && !busy && !crisisMessage && (
        <section aria-labelledby="scene-history-heading">
          <h2 id="scene-history-heading" className="mb-3 text-sm font-medium text-muted">
            {t('history')}
          </h2>
          <ul className="space-y-2">
            {displayedSessions.map((session) => (
              <li key={session.runId}>
                <button
                  type="button"
                  onClick={() => router.replace(`/dream-scenes?run=${session.runId}`)}
                  className="glass flex w-full items-center justify-between gap-4 px-4 py-3 text-start transition hover:bg-white/10"
                >
                  <span className="min-w-0 truncate">{session.dream}</span>
                  <span className="shrink-0 text-xs text-muted">
                    {t('sceneNumber', { number: session.sceneNumber })}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
