'use client';

import dynamic from 'next/dynamic';
import type { WorldGoal, WorldObstacle, WorldProfile, WorldStep } from '@/lib/validation/world';

const NomoukWorld = dynamic(() => import('./NomoukWorld').then((module) => module.NomoukWorld), {
  ssr: false,
  loading: () => (
    <div
      aria-hidden="true"
      className="relative h-[calc(100dvh-7.5rem)] overflow-hidden bg-[var(--w-base)] lg:h-dvh"
    >
      <div className="world-skeleton absolute start-4 top-4 h-11 w-56 rounded-[10px] border border-[var(--w-border)] sm:start-6 sm:top-6" />
      <div className="world-skeleton absolute end-4 top-4 h-11 w-11 rounded-[10px] border border-[var(--w-border)] sm:end-6 sm:top-6" />
      <div className="world-skeleton absolute inset-x-0 bottom-0 h-[42%] border-t border-[var(--w-border)]" />
      <div className="world-skeleton absolute inset-x-[16%] bottom-[23%] h-[18%] rounded-[45%] border border-[var(--w-border)]" />
      <div className="world-skeleton absolute bottom-4 start-1/3 h-11 w-1/3 rounded-[10px] border border-[var(--w-border)] lg:bottom-6" />
    </div>
  ),
});

export function WorldPageClient(props: {
  profile: WorldProfile;
  goals: WorldGoal[];
  obstacles: WorldObstacle[];
  steps: WorldStep[];
  moodKey: string | null;
  loadError: boolean;
}) {
  return <NomoukWorld {...props} />;
}
