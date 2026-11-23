'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { createWorldEngine, type CameraMode, type WorldEngine } from '@/components/world/engine';
import type { WorldGoal, WorldObstacle, WorldProfile, WorldStep } from '@/lib/validation/world';

export function WorldScene({
  profile,
  goals,
  obstacles,
  steps,
  moodKey,
  camera,
  selectedGoalId,
  onSelectGoal,
  onSupportChange,
}: {
  profile: WorldProfile;
  goals: WorldGoal[];
  obstacles: WorldObstacle[];
  steps: WorldStep[];
  moodKey: string | null;
  camera: CameraMode;
  selectedGoalId: string | null;
  onSelectGoal: (goalId: string) => void;
  onSupportChange: (supported: boolean) => void;
}) {
  const t = useTranslations('world');
  const locale = useLocale();
  const sceneData = useMemo(() => ({ profile, goals, obstacles, steps, moodKey }), [profile, goals, obstacles, steps, moodKey]);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<WorldEngine | null>(null);
  const sceneDataRef = useRef(sceneData);
  const cameraRef = useRef(camera);
  const selectedGoalRef = useRef(selectedGoalId);
  const onSelectGoalRef = useRef(onSelectGoal);
  const [supported, setSupported] = useState<boolean | null>(null);

  useEffect(() => {
    if (supported !== null) onSupportChange(supported);
  }, [onSupportChange, supported]);

  useEffect(() => {
    sceneDataRef.current = sceneData;
    cameraRef.current = camera;
    selectedGoalRef.current = selectedGoalId;
    onSelectGoalRef.current = onSelectGoal;
    engineRef.current?.update(sceneData, camera, selectedGoalId);
  }, [sceneData, camera, selectedGoalId, onSelectGoal]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const engine = createWorldEngine(
      canvas,
      sceneDataRef.current,
      cameraRef.current,
      selectedGoalRef.current,
      (goalId) => onSelectGoalRef.current(goalId),
      () => {
        engineRef.current?.dispose();
        engineRef.current = null;
        setSupported(false);
      },
      () => setSupported(true),
    );
    if (!engine) {
      setSupported(false);
      return;
    }
    engineRef.current = engine;
    return () => {
      engine.dispose();
      engineRef.current = null;
    };
  }, []);

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (!goals.length) return;
    const currentIndex = Math.max(0, goals.findIndex((goal) => goal.id === selectedGoalId));
    const reverse = locale === 'ar';
    const forwardKey = reverse ? 'ArrowLeft' : 'ArrowRight';
    const backwardKey = reverse ? 'ArrowRight' : 'ArrowLeft';
    let nextIndex: number | undefined;
    if (event.key === forwardKey || event.key === 'ArrowDown') {
      nextIndex = (currentIndex + 1 + goals.length) % goals.length;
    } else if (event.key === backwardKey || event.key === 'ArrowUp') {
      nextIndex = (currentIndex - 1 + goals.length) % goals.length;
    } else if (event.key === 'Home') {
      nextIndex = 0;
    } else if (event.key === 'End') {
      nextIndex = goals.length - 1;
    }
    if (nextIndex === undefined) return;
    event.preventDefault();
    onSelectGoal(goals[nextIndex].id);
  };

  if (supported === false) {
    return (
      <div
        className="absolute inset-0 overflow-auto border-y border-[var(--w-border)] bg-[var(--w-surface)] px-5 pb-28 pt-36 text-[var(--w-ink)] sm:px-8 sm:pt-40"
        role="status"
      >
        <div className="mx-auto max-w-3xl">
          <p className="font-heading text-2xl font-semibold sm:text-3xl">{t('scene.fallbackTitle')}</p>
          <p className="mt-3 max-w-xl text-sm leading-6 text-[var(--w-muted)]">{t('scene.fallbackDescription')}</p>
          {goals.length === 0 && (
            <Link
              href="/roadmap"
              className="mt-5 inline-flex min-h-11 items-center justify-center rounded-[10px] bg-[var(--w-primary)] px-5 text-sm font-semibold text-[var(--w-primary-ink)] transition hover:bg-[var(--w-primary-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--w-accent)]"
            >
              {t('scene.emptyAction')}
            </Link>
          )}
          <div className="mt-8 grid gap-8 sm:grid-cols-2">
            <div>
              <h2 className="text-sm font-semibold text-[var(--w-ink)]">{t('goals.title')}</h2>
              <ul className="mt-3 space-y-2 text-sm text-[var(--w-muted)]">
                {goals.length
                  ? goals.map((goal) => <li key={goal.id}>{goal.title}</li>)
                  : <li>{t('goals.empty')}</li>}
              </ul>
            </div>
            <div>
              <h2 className="text-sm font-semibold text-[var(--w-ink)]">{t('obstacles.title')}</h2>
              <ul className="mt-3 space-y-2 text-sm text-[var(--w-muted)]">
                {obstacles.length
                  ? obstacles.map((obstacle) => <li key={obstacle.id}>{obstacle.title}</li>)
                  : <li>{t('obstacles.empty')}</li>}
              </ul>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div
        className="world-scene absolute inset-0"
        role="group"
        tabIndex={0}
        aria-label={t('scene.canvasLabel')}
        aria-describedby="world-scene-instructions"
        onKeyDown={onKeyDown}
      >
        <canvas
          ref={canvasRef}
          className={`block h-full w-full bg-[var(--w-base)] ${goals.length ? 'cursor-pointer' : ''}`}
          aria-hidden="true"
        />
      </div>
      <p id="world-scene-instructions" className="sr-only">
        {t('scene.selectGoal')}
      </p>
      {supported !== true && (
        <div aria-hidden="true" className="world-scene-loading pointer-events-none absolute inset-0 z-[1]">
            <div className="world-skeleton absolute inset-x-0 bottom-0 h-[44%] border-t border-[var(--w-border)]" />
            <div className="world-skeleton absolute inset-x-[14%] bottom-[23%] h-[16%] rounded-[45%] border border-[var(--w-border)]" />
        </div>
      )}
    </>
  );
}
