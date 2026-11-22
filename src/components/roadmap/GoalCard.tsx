'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Alert } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ConfirmSubmitButton } from '@/components/ui/ConfirmSubmitButton';
import { GoalEditForm } from '@/components/roadmap/RoadmapForms';
import { useRouter } from '@/i18n/navigation';
import type { RoadmapGoal, RoadmapMilestone, RoadmapTask } from '@/lib/validation/roadmap';
import { deleteGoal } from '@/server/services/roadmap';
import { MilestoneList } from '@/components/roadmap/MilestoneList';
import { TaskList } from '@/components/roadmap/TaskList';

export function GoalCard({
  goal,
  milestones,
  tasks,
}: {
  goal: RoadmapGoal;
  milestones: RoadmapMilestone[];
  tasks: RoadmapTask[];
}) {
  const t = useTranslations('roadmap');
  const locale = useLocale();
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [errorCode, setErrorCode] = useState<string | null>(null);

  function formatDate(date: string) {
    return new Intl.DateTimeFormat(locale === 'ar' ? 'ar-EG' : 'en-US', {
      dateStyle: 'medium',
      timeZone: 'UTC',
    }).format(new Date(`${date}T12:00:00.000Z`));
  }

  async function handleDelete() {
    if (deleting) return;
    setDeleting(true);
    setErrorCode(null);
    try {
      const result = await deleteGoal({ id: goal.id });
      if (result.status === 'success') router.refresh();
      else setErrorCode(result.code);
    } catch {
      setErrorCode('generic');
    } finally {
      setDeleting(false);
    }
  }

  const goalTasks = tasks.filter((task) => task.milestone_id === null);

  return (
    <Card className="space-y-4 border-glass-border/80">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="break-words font-heading text-lg font-semibold">{goal.title}</h3>
            <Badge tone={goal.status === 'completed' ? 'gold' : 'muted'}>
              {t(`statuses.${goal.status}`)}
            </Badge>
          </div>
          {goal.description && <p className="mt-2 whitespace-pre-wrap text-sm text-muted">{goal.description}</p>}
          {goal.deadline && (
            <p className="mt-2 text-xs text-muted">
              {t('goals.deadlineValue', { date: formatDate(goal.deadline) })}
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="ghost"
            className="h-10 px-4 text-sm"
            onClick={() => setEditing((current) => !current)}
          >
            {editing ? t('cancel') : t('edit')}
          </Button>
          <form onSubmit={(event) => {
            event.preventDefault();
            void handleDelete();
          }}>
            <ConfirmSubmitButton
              confirmText={t('goals.deleteConfirm')}
              disabled={deleting}
              className="h-10 rounded-pill border border-red-400/30 px-4 text-sm text-red-200 transition hover:bg-red-500/10 disabled:opacity-60"
            >
              {deleting ? t('deleting') : t('goals.delete')}
            </ConfirmSubmitButton>
          </form>
        </div>
      </div>
      {errorCode && <Alert>{t(`errors.${errorCode}`)}</Alert>}
      {editing && (
        <GoalEditForm
          goal={goal}
          onCancel={() => setEditing(false)}
          onSaved={() => {
            setEditing(false);
            router.refresh();
          }}
        />
      )}
      <div>
        <div className="mb-2 flex items-center justify-between text-sm">
          <span className="text-muted">{t('goals.progress')}</span>
          <span className="font-medium">{goal.progress}%</span>
        </div>
        <div
          role="progressbar"
          aria-label={t('goals.progress')}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={goal.progress}
          className="h-2.5 overflow-hidden rounded-pill bg-white/10"
        >
          <div
            className="h-full rounded-pill bg-gradient-to-r from-[#6D28D9] to-primary transition-[width]"
            style={{ width: `${goal.progress}%` }}
          />
        </div>
      </div>
      <MilestoneList goalId={goal.id} milestones={milestones} tasks={tasks} />
      <TaskList goalId={goal.id} milestoneId={null} tasks={goalTasks} />
    </Card>
  );
}
