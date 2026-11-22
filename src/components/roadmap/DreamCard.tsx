'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ConfirmSubmitButton } from '@/components/ui/ConfirmSubmitButton';
import { useRouter } from '@/i18n/navigation';
import type { RoadmapDream, RoadmapGoal, RoadmapMilestone, RoadmapTask } from '@/lib/validation/roadmap';
import { deleteDream } from '@/server/services/roadmap';
import { GoalCard } from '@/components/roadmap/GoalCard';

export function DreamCard({
  dream,
  goals,
  milestones,
  tasks,
}: {
  dream: RoadmapDream;
  goals: RoadmapGoal[];
  milestones: RoadmapMilestone[];
  tasks: RoadmapTask[];
}) {
  const t = useTranslations('roadmap');
  const router = useRouter();
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    if (deleting) return;
    setDeleting(true);
    setErrorCode(null);
    try {
      const result = await deleteDream({ id: dream.id });
      if (result.status === 'success') router.refresh();
      else setErrorCode(result.code);
    } catch {
      setErrorCode('generic');
    } finally {
      setDeleting(false);
    }
  }

  return (
    <Card className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-heading text-xl font-semibold">{dream.title}</h2>
        <form onSubmit={(event) => {
          event.preventDefault();
          void handleDelete();
        }}>
          <ConfirmSubmitButton
            confirmText={t('dreams.deleteConfirm')}
            disabled={deleting}
            className="h-10 rounded-pill border border-red-400/30 px-4 text-sm text-red-200 transition hover:bg-red-500/10 disabled:opacity-60"
          >
            {deleting ? t('deleting') : t('dreams.delete')}
          </ConfirmSubmitButton>
        </form>
      </div>
      {errorCode && <Alert>{t(`errors.${errorCode}`)}</Alert>}
      {goals.length ? (
        <div className="space-y-4">
          {goals.map((goal) => (
            <GoalCard
              key={goal.id}
              goal={goal}
              milestones={milestones.filter((milestone) => milestone.goal_id === goal.id)}
              tasks={tasks.filter((task) => task.goal_id === goal.id)}
            />
          ))}
        </div>
      ) : (
        <p className="rounded-xl border border-glass-border px-4 py-3 text-sm text-muted">
          {t('dreams.noGoals')}
        </p>
      )}
    </Card>
  );
}
