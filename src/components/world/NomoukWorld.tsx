'use client';

import { AnimatePresence, motion, useDragControls, useReducedMotion } from 'framer-motion';
import dynamic from 'next/dynamic';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import { IconButton } from '@/components/ui/IconButton';
import { Segmented, type SegmentOption } from '@/components/ui/Segmented';
import { WorldCharacterForm } from '@/components/world/WorldCharacterForm';
import type { CameraMode } from '@/components/world/engine';
import type { WorldGoal, WorldObstacle, WorldProfile, WorldStep } from '@/lib/validation/world';
import { Link } from '@/i18n/navigation';

const WorldScene = dynamic(() => import('./scene').then((module) => module.WorldScene), {
  ssr: false,
  loading: () => <SceneSkeleton />,
});

type PanelTab = 'character' | 'companion' | 'goals';

export function NomoukWorld({
  profile: initialProfile,
  goals,
  obstacles,
  steps,
  moodKey,
  loadError,
}: {
  profile: WorldProfile;
  goals: WorldGoal[];
  obstacles: WorldObstacle[];
  steps: WorldStep[];
  moodKey: string | null;
  loadError: boolean;
}) {
  const t = useTranslations('world');
  const tm = useTranslations('mood');
  const locale = useLocale();
  const reduceMotion = useReducedMotion();
  const [profile, setProfile] = useState(initialProfile);
  const [camera, setCamera] = useState<CameraMode>('chase');
  const [activeTab, setActiveTab] = useState<PanelTab>('goals');
  const [selectedGoalId, setSelectedGoalId] = useState<string | null>(goals[0]?.id ?? null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [sceneReady, setSceneReady] = useState(false);
  const panelRef = useRef<HTMLElement>(null);
  const panelToggleRef = useRef<HTMLButtonElement>(null);
  const dragControls = useDragControls();

  useEffect(() => {
    const media = window.matchMedia('(max-width: 1023px)');
    const syncViewport = () => {
      setIsMobile(media.matches);
      setPanelOpen(!media.matches);
    };
    syncViewport();
    media.addEventListener('change', syncViewport);
    return () => media.removeEventListener('change', syncViewport);
  }, []);

  useEffect(() => {
    if (!goals.some((goal) => goal.id === selectedGoalId)) {
      setSelectedGoalId(goals[0]?.id ?? null);
    }
  }, [goals, selectedGoalId]);

  useEffect(() => {
    if (!isMobile || !panelOpen) return;
    const panel = panelRef.current;
    if (!panel) return;
    const toggleButton = panelToggleRef.current;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const getFocusable = () =>
      Array.from(
        panel.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([type="hidden"]):not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((element) => !element.closest('[hidden]') && element.getClientRects().length > 0);
    getFocusable()[0]?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setPanelOpen(false);
        return;
      }
      if (event.key !== 'Tab') return;
      const focusable = getFocusable();
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && (document.activeElement === first || !panel.contains(document.activeElement))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || !panel.contains(document.activeElement))) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      if (previousFocus?.isConnected) previousFocus.focus();
      else toggleButton?.focus();
    };
  }, [isMobile, panelOpen]);

  const activeGoal = goals.find((goal) => goal.id === selectedGoalId);
  const moodLabel = getMoodLabel(moodKey, tm, t);
  const overcomeCount = obstacles.filter((obstacle) => obstacle.status === 'overcome').length;
  const panelTabs: SegmentOption[] = [
    { value: 'goals', label: t('panel.tabs.goals') },
    { value: 'character', label: t('panel.tabs.character') },
    { value: 'companion', label: t('panel.tabs.companion') },
  ];
  const cameraOptions: SegmentOption[] = [
    {
      value: 'top',
      label: <span className="sr-only sm:not-sr-only">{t('scene.cameras.top')}</span>,
      icon: <CameraIcon mode="top" />,
    },
    {
      value: 'chase',
      label: <span className="sr-only sm:not-sr-only">{t('scene.cameras.chase')}</span>,
      icon: <CameraIcon mode="chase" />,
    },
    {
      value: 'firstPerson',
      label: <span className="sr-only sm:not-sr-only">{t('scene.cameras.firstPerson')}</span>,
      icon: <CameraIcon mode="firstPerson" />,
    },
  ];

  const focusGoal = (goalId: string) => {
    setSelectedGoalId(goalId);
    setCamera('chase');
  };

  return (
    <main className="relative isolate h-[calc(100dvh-7.5rem)] w-full overflow-hidden bg-[var(--w-base)] text-[var(--w-ink)] lg:h-dvh">
      <WorldScene
        profile={profile}
        goals={goals}
        obstacles={obstacles}
        steps={steps}
        moodKey={moodKey}
        camera={camera}
        selectedGoalId={selectedGoalId}
        onSelectGoal={focusGoal}
        onSupportChange={setSceneReady}
      />

      <header className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-start justify-between gap-4 px-5 py-5 sm:px-8 sm:py-7">
        <div className="pointer-events-auto min-w-0 max-w-[min(100%,34rem)]">
          <p className="flex items-center gap-2 text-xs font-medium tracking-wide text-[var(--w-muted)] sm:text-sm">
            <span className="h-px w-5 bg-[var(--w-accent)]" aria-hidden="true" />
            <span>{moodLabel}</span>
          </p>
          <h1 className="mt-2 font-heading text-2xl font-semibold leading-tight text-[var(--w-ink)] sm:text-4xl">
            {t('title')}
          </h1>
          <p className="mt-2 max-w-lg truncate text-sm text-[var(--w-muted)] sm:text-base">
            {activeGoal?.title ?? t('description')}
          </p>
          <p aria-live="polite" className="sr-only">
            {activeGoal?.title ?? t('goals.unlinked')}
          </p>
          <div className="mt-4 flex flex-wrap gap-x-5 gap-y-1 text-xs text-[var(--w-muted)] sm:text-sm">
            <span>{t('summary.goals', { count: goals.length })}</span>
            <span>{t('summary.overcome', { count: overcomeCount })}</span>
          </div>
        </div>
        <IconButton
          ref={panelToggleRef}
          icon="panel"
          aria-label={panelOpen ? t('panel.hide') : t('panel.show')}
          aria-expanded={panelOpen}
          onClick={() => setPanelOpen((open) => !open)}
          className="pointer-events-auto"
        />
      </header>

      {loadError && (
        <div
          role="alert"
          className="absolute start-5 top-36 z-10 flex max-w-[calc(100%-2.5rem)] items-center gap-2 border-s-2 border-[var(--w-danger)] bg-[var(--w-surface)] px-4 py-3 text-sm text-[var(--w-ink)] sm:start-8 sm:top-40"
        >
          <ErrorIcon />
          <span>{t('errors.load_failed')}</span>
        </div>
      )}

      {goals.length === 0 && (
        <div className="pointer-events-none absolute inset-x-5 top-[38%] z-[2] flex justify-center sm:inset-x-8">
          <section className="pointer-events-auto w-full max-w-md border border-[var(--w-border)] bg-[var(--w-surface)] p-5 sm:p-7">
            <p className="text-xs font-medium text-[var(--w-muted)]">{t('scene.title')}</p>
            <h2 className="mt-2 font-heading text-xl font-semibold text-[var(--w-ink)] sm:text-2xl">
              {t('scene.emptyTitle')}
            </h2>
            <p className="mt-2 text-sm leading-6 text-[var(--w-muted)]">{t('scene.emptyDescription')}</p>
            <Link
              href="/roadmap"
              className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-[10px] bg-[var(--w-primary)] px-5 text-sm font-semibold text-[var(--w-primary-ink)] transition hover:bg-[var(--w-primary-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--w-accent)]"
            >
              {t('scene.emptyAction')}
              <ArrowIcon />
            </Link>
          </section>
        </div>
      )}

      {sceneReady && (
        <div className="absolute inset-x-0 bottom-3 z-10 flex flex-col items-center gap-2 px-4 lg:bottom-5">
          <p className="text-xs text-[var(--w-muted)]">{t('scene.controls')}</p>
          <Segmented
            label={t('scene.cameraLabel')}
            value={camera}
            options={cameraOptions}
            onChange={(value) => {
              if (value === 'top' || value === 'chase' || value === 'firstPerson') setCamera(value);
            }}
            className="gap-1"
          />
        </div>
      )}

      <AnimatePresence initial={false}>
        {panelOpen && (
          <motion.aside
            ref={panelRef}
            key="world-panel"
            role={isMobile ? 'dialog' : 'complementary'}
            aria-modal={isMobile || undefined}
            aria-labelledby="world-panel-title"
            drag={isMobile ? 'y' : false}
            dragControls={dragControls}
            dragListener={false}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={0.12}
            dragMomentum={false}
            onDragEnd={(_, info) => {
              if (isMobile && info.offset.y > 88) setPanelOpen(false);
            }}
            initial={panelInitial(isMobile, locale, reduceMotion)}
            animate={{ opacity: 1, x: 0, y: 0 }}
            exit={panelExit(isMobile, locale, reduceMotion)}
            transition={reduceMotion ? { duration: 0 } : { type: 'spring', stiffness: 320, damping: 34 }}
            className={`absolute z-30 flex min-h-0 flex-col overflow-hidden border border-[var(--w-border)] bg-[var(--w-surface)] ${
              isMobile
                ? 'inset-x-0 bottom-0 max-h-[82%] rounded-t-[12px]'
                : 'inset-y-4 end-4 w-[380px] max-w-[calc(100%-2rem)] rounded-[12px]'
            }`}
          >
            {isMobile && (
              <div
                role="separator"
                aria-orientation="horizontal"
                aria-label={t('panel.drag')}
                onPointerDown={(event) => dragControls.start(event)}
                className="flex h-8 shrink-0 cursor-grab touch-none items-center justify-center active:cursor-grabbing"
              >
                <span className="h-1 w-10 rounded-full bg-[var(--w-muted)]" />
              </div>
            )}
            <div className="flex items-start justify-between gap-2 px-5 pb-4 pt-3">
              <div className="min-w-0">
                <p className="text-xs font-medium text-[var(--w-muted)]">{moodLabel}</p>
                <h2 id="world-panel-title" className="mt-1 font-heading text-xl font-semibold text-[var(--w-ink)]">
                  {t('panel.title')}
                </h2>
              </div>
              {isMobile && (
                <IconButton icon="close" aria-label={t('panel.close')} onClick={() => setPanelOpen(false)} />
              )}
            </div>

            <div className="px-5 pb-4">
              <Segmented
                label={t('panel.tabs.label')}
                value={activeTab}
                options={panelTabs}
                onChange={(value) => {
                  if (value === 'goals' || value === 'character' || value === 'companion') setActiveTab(value);
                }}
                className="grid w-full grid-cols-3 gap-1"
              />
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5">
              {activeTab === 'goals' ? (
                <GoalsPanel
                  goals={goals}
                  obstacles={obstacles}
                  steps={steps}
                  selectedGoalId={selectedGoalId}
                  onSelectGoal={focusGoal}
                />
              ) : (
                <WorldCharacterForm profile={profile} section={activeTab} onProfileChange={setProfile} />
              )}
            </div>
          </motion.aside>
        )}
      </AnimatePresence>
    </main>
  );
}

function GoalsPanel({
  goals,
  obstacles,
  steps,
  selectedGoalId,
  onSelectGoal,
}: {
  goals: WorldGoal[];
  obstacles: WorldObstacle[];
  steps: WorldStep[];
  selectedGoalId: string | null;
  onSelectGoal: (goalId: string) => void;
}) {
  const t = useTranslations('world');
  const selectedGoal = goals.find((goal) => goal.id === selectedGoalId);
  const linkedObstacles = selectedGoal
    ? obstacles.filter((obstacle) => obstacle.goal_id === selectedGoal.id)
    : [];
  const unlinkedObstacles = obstacles.filter((obstacle) => obstacle.goal_id === null);

  return (
    <div className="space-y-6">
      <section>
        <div className="flex items-end justify-between gap-3">
          <h3 className="font-heading text-lg font-semibold text-[var(--w-ink)]">{t('goals.title')}</h3>
          <span className="text-xs text-[var(--w-muted)]">{t('summary.goals', { count: goals.length })}</span>
        </div>
        {goals.length ? (
          <ul className="mt-3 space-y-2">
            {goals.map((goal, index) => {
              const related = obstacles.filter((obstacle) => obstacle.goal_id === goal.id);
              const open = related.filter((obstacle) => obstacle.status === 'open').length;
              const overcome = related.filter((obstacle) => obstacle.status === 'overcome').length;
              const selected = goal.id === selectedGoalId;
              return (
                <li key={goal.id}>
                  <button
                    type="button"
                    aria-pressed={selected}
                    onClick={() => onSelectGoal(goal.id)}
                    className={`flex min-h-16 w-full items-center gap-3 border px-3 py-3 text-start transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--w-accent)] ${
                      selected
                        ? 'border-[var(--w-accent)] bg-[var(--w-surface-2)]'
                        : 'border-[var(--w-border)] bg-transparent hover:bg-[var(--w-surface-2)]'
                    }`}
                  >
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-[var(--w-border)] text-xs text-[var(--w-muted)]">
                      {index + 1}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-[var(--w-ink)]">{goal.title}</span>
                      <span className="mt-1 flex flex-wrap gap-x-3 text-xs text-[var(--w-muted)]">
                        <span>{t('panel.openCount', { count: open })}</span>
                        <span className="text-[var(--w-sand)]">{t('panel.overcomeCount', { count: overcome })}</span>
                      </span>
                    </span>
                    <span className="text-[var(--w-muted)]" aria-hidden="true">
                      <ChevronIcon />
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="mt-3 border border-[var(--w-border)] px-4 py-4">
            <p className="text-sm leading-6 text-[var(--w-muted)]">{t('goals.empty')}</p>
            <Link
              href="/roadmap"
              className="mt-3 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-[var(--w-ink)] underline decoration-[var(--w-accent)] underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--w-accent)]"
            >
              {t('scene.emptyAction')}
              <ArrowIcon />
            </Link>
          </div>
        )}
      </section>

      <section aria-labelledby="world-obstacles-heading">
        <h3 id="world-obstacles-heading" className="font-heading text-lg font-semibold text-[var(--w-ink)]">
          {selectedGoal ? t('obstacles.title') : t('obstacles.unlinkedTitle')}
        </h3>
        {selectedGoal && (
          <>
            <p className="mt-1 truncate text-sm text-[var(--w-muted)]">{selectedGoal.title}</p>
            {linkedObstacles.length ? (
              <ObstacleList obstacles={linkedObstacles} steps={steps} />
            ) : (
              <p className="mt-3 border-s border-[var(--w-border)] py-2 ps-3 text-sm text-[var(--w-muted)]">
                {t('obstacles.empty')}
              </p>
            )}
          </>
        )}
        {unlinkedObstacles.length > 0 && (
          <div className={selectedGoal ? 'mt-5 border-t border-[var(--w-border)] pt-4' : 'mt-3'}>
            {selectedGoal && (
              <h4 className="text-sm font-medium text-[var(--w-muted)]">{t('obstacles.unlinkedTitle')}</h4>
            )}
            <ObstacleList obstacles={unlinkedObstacles} steps={steps} />
          </div>
        )}
        {!selectedGoal && unlinkedObstacles.length === 0 && (
          <p className="mt-3 border-s border-[var(--w-border)] py-2 ps-3 text-sm text-[var(--w-muted)]">
            {t('obstacles.empty')}
          </p>
        )}
      </section>
    </div>
  );
}

function ObstacleList({ obstacles, steps }: { obstacles: WorldObstacle[]; steps: WorldStep[] }) {
  const t = useTranslations('world');
  return (
    <ul className="mt-3 space-y-2">
      {obstacles.map((obstacle) => {
        const obstacleSteps = steps.filter((step) => step.obstacle_id === obstacle.id);
        return (
          <li key={obstacle.id} className="border border-[var(--w-border)] px-3 py-3">
            <div className="flex items-start gap-2">
              <StatusIcon status={obstacle.status} />
              <div className="min-w-0 flex-1">
                <p className="break-words text-sm text-[var(--w-ink)]">{obstacle.title}</p>
                <p className={`mt-1 text-xs ${obstacle.status === 'overcome' ? 'text-[var(--w-sand)]' : 'text-[var(--w-muted)]'}`}>
                  {t(`obstacles.status.${obstacle.status}`)}
                </p>
              </div>
            </div>
            {obstacleSteps.length > 0 && (
              <ul className="ms-2 mt-3 space-y-2 border-s border-[var(--w-border)] ps-3">
                {obstacleSteps.map((step) => (
                  <li key={step.id} className="flex items-start gap-2 text-xs leading-5 text-[var(--w-muted)]">
                    <StepIcon complete={step.completed_at !== null} />
                    <span className="sr-only">
                      {step.completed_at ? t('steps.complete') : t('steps.pending')}
                    </span>
                    <span className={step.completed_at ? 'text-[var(--w-ink)]' : ''}>{step.title}</span>
                  </li>
                ))}
              </ul>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function SceneSkeleton() {
  return (
    <div aria-hidden="true" className="absolute inset-0 bg-[var(--w-base)]">
      <div className="world-skeleton absolute inset-x-0 bottom-0 h-[42%] border-t border-[var(--w-border)]" />
      <div className="world-skeleton absolute inset-x-[16%] bottom-[23%] h-[18%] rounded-[45%] border border-[var(--w-border)]" />
      <div className="world-skeleton absolute inset-x-0 top-[22%] h-[16%]" />
    </div>
  );
}

function ErrorIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="h-5 w-5 shrink-0 text-[var(--w-danger)]"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M12 8v5M12 16h.01" />
    </svg>
  );
}

function StatusIcon({ status }: { status: WorldObstacle['status'] }) {
  return (
    <span className="mt-0.5 shrink-0" aria-hidden="true">
      {status === 'overcome' ? <CheckIcon className="text-[var(--w-sand)]" /> : <CircleIcon />}
    </span>
  );
}

function StepIcon({ complete }: { complete: boolean }) {
  return (
    <span className="mt-0.5 shrink-0" aria-hidden="true">
      {complete ? <CheckIcon className="text-[var(--w-accent)]" /> : <CircleIcon />}
    </span>
  );
}

function CheckIcon({ className = '' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`h-4 w-4 ${className}`}
    >
      <path d="m4 10 4 4 8-8" />
    </svg>
  );
}

function CircleIcon() {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      aria-hidden="true"
      className="h-4 w-4 text-[var(--w-muted)]"
    >
      <circle cx="10" cy="10" r="6.5" />
    </svg>
  );
}

function ChevronIcon() {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="h-4 w-4 rtl:rotate-180"
    >
      <path d="m7 4 6 6-6 6" />
    </svg>
  );
}

function ArrowIcon() {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="h-4 w-4 rtl:rotate-180"
    >
      <path d="M3 10h13M11 5l5 5-5 5" />
    </svg>
  );
}

function CameraIcon({ mode }: { mode: CameraMode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="h-5 w-5 shrink-0"
    >
      {mode === 'top' ? (
        <>
          <path d="M12 3v18M8 7l4-4 4 4M8 17l4 4 4-4" />
          <circle cx="12" cy="12" r="2" />
        </>
      ) : mode === 'chase' ? (
        <>
          <circle cx="12" cy="7" r="2" />
          <path d="M8 20v-3a4 4 0 0 1 8 0v3M4 8v8M2.5 10h3" />
        </>
      ) : (
        <>
          <path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" />
          <circle cx="12" cy="12" r="2.5" />
        </>
      )}
    </svg>
  );
}

function getMoodLabel(
  moodKey: string | null,
  tm: ReturnType<typeof useTranslations<'mood'>>,
  t: ReturnType<typeof useTranslations<'world'>>,
) {
  if (
    moodKey === 'joyful' ||
    moodKey === 'grateful' ||
    moodKey === 'calm' ||
    moodKey === 'hopeful' ||
    moodKey === 'motivated' ||
    moodKey === 'tired' ||
    moodKey === 'anxious' ||
    moodKey === 'sad' ||
    moodKey === 'angry' ||
    moodKey === 'lonely'
  ) {
    return tm(`moods.${moodKey}`);
  }
  return t('scene.weather.clearShort');
}

function panelInitial(isMobile: boolean, locale: string, reduceMotion: boolean | null) {
  if (reduceMotion) return false;
  return isMobile ? { opacity: 0, y: '100%' } : { opacity: 0, x: locale === 'ar' ? -24 : 24 };
}

function panelExit(isMobile: boolean, locale: string, reduceMotion: boolean | null) {
  if (reduceMotion) return { opacity: 0 };
  return isMobile ? { opacity: 0, y: '100%' } : { opacity: 0, x: locale === 'ar' ? -24 : 24 };
}
