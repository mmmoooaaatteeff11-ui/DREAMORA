'use client';

import { useState, type FormEvent } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { ConfirmSubmitButton } from '@/components/ui/ConfirmSubmitButton';
import { Input } from '@/components/ui/Input';
import { useRouter } from '@/i18n/navigation';
import type { RoadmapMilestone, RoadmapTask } from '@/lib/validation/roadmap';
import {
  createMilestone,
  deleteMilestone,
  reorderMilestone,
  toggleMilestone,
} from '@/server/services/roadmap';
import { TaskList } from '@/components/roadmap/TaskList';

export function MilestoneList({
  goalId,
  milestones,
  tasks,
}: {
  goalId: string;
  milestones: RoadmapMilestone[];
  tasks: RoadmapTask[];
}) {
  const t = useTranslations('roadmap');
  const locale = useLocale();
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [saving, setSaving] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);

  const orderedMilestones = [...milestones].sort((a, b) =>
    a.position - b.position || a.created_at.localeCompare(b.created_at),
  );

  function formatDate(date: string) {
    return new Intl.DateTimeFormat(locale === 'ar' ? 'ar-EG' : 'en-US', {
      dateStyle: 'medium',
      timeZone: 'UTC',
    }).format(new Date(`${date}T12:00:00.000Z`));
  }

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setErrorCode(null);
    try {
      const result = await createMilestone({ goalId, title, dueDate: dueDate || null });
      if (result.status === 'success') {
        setTitle('');
        setDueDate('');
        router.refresh();
      } else {
        setErrorCode(result.code);
      }
    } catch {
      setErrorCode('generic');
    } finally {
      setSaving(false);
    }
  }

  async function handleToggle(milestone: RoadmapMilestone, completed: boolean) {
    setPendingId(milestone.id);
    setErrorCode(null);
    try {
      const result = await toggleMilestone({ id: milestone.id, goalId, completed });
      if (result.status === 'success') router.refresh();
      else setErrorCode(result.code);
    } catch {
      setErrorCode('generic');
    } finally {
      setPendingId(null);
    }
  }

  async function handleReorder(milestone: RoadmapMilestone, direction: 'up' | 'down') {
    setPendingId(milestone.id);
    setErrorCode(null);
    try {
      const result = await reorderMilestone({ id: milestone.id, goalId, direction });
      if (result.status === 'success') router.refresh();
      else setErrorCode(result.code);
    } catch {
      setErrorCode('generic');
    } finally {
      setPendingId(null);
    }
  }

  async function handleDelete(milestone: RoadmapMilestone) {
    setPendingId(milestone.id);
    setErrorCode(null);
    try {
      const result = await deleteMilestone({ id: milestone.id, goalId });
      if (result.status === 'success') router.refresh();
      else setErrorCode(result.code);
    } catch {
      setErrorCode('generic');
    } finally {
      setPendingId(null);
    }
  }

  return (
    <section className="space-y-3 border-t border-glass-border pt-4">
      <h4 className="font-medium">{t('milestones.title')}</h4>
      <form onSubmit={handleCreate} className="grid gap-3 sm:grid-cols-[1fr_auto_auto]">
        <Input
          name={`milestoneTitle-${goalId}`}
          label={t('milestones.titleLabel')}
          value={title}
          maxLength={200}
          required
          onChange={(event) => setTitle(event.target.value)}
        />
        <div className="space-y-1.5">
          <label htmlFor={`milestone-date-${goalId}`} className="block text-sm font-medium text-ink">
            {t('milestones.dueDateLabel')}
          </label>
          <input
            id={`milestone-date-${goalId}`}
            type="date"
            value={dueDate}
            onChange={(event) => setDueDate(event.target.value)}
            className="h-12 w-full rounded-xl border border-glass-border bg-glass px-4 text-ink outline-none focus:border-primary-light"
          />
        </div>
        <Button type="submit" loading={saving} className="self-end">{t('milestones.add')}</Button>
      </form>

      {errorCode && <Alert>{t(`errors.${errorCode}`)}</Alert>}
      {orderedMilestones.length === 0 ? (
        <p className="text-sm text-muted">{t('milestones.empty')}</p>
      ) : (
        <ol className="space-y-3">
          {orderedMilestones.map((milestone, index) => {
            const milestoneTasks = tasks.filter((task) => task.milestone_id === milestone.id);
            return (
              <li key={milestone.id} className="rounded-xl border border-glass-border p-3">
                <div className="flex flex-wrap items-center gap-3">
                  <input
                    type="checkbox"
                    checked={milestone.completed_at !== null}
                    disabled={pendingId !== null}
                    aria-label={t('milestones.toggle', { title: milestone.title })}
                    onChange={(event) => void handleToggle(milestone, event.target.checked)}
                    className="h-4 w-4 accent-violet-500"
                  />
                  <div className="min-w-0 flex-1">
                    <p className={`break-words text-sm ${milestone.completed_at ? 'text-muted line-through' : 'text-ink'}`}>
                      {milestone.title}
                    </p>
                    {milestone.due_date && <p className="mt-1 text-xs text-muted">{formatDate(milestone.due_date)}</p>}
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      className="h-9 w-9 px-0"
                      aria-label={t('moveUp', { title: milestone.title })}
                      disabled={pendingId !== null || index === 0}
                      onClick={() => void handleReorder(milestone, 'up')}
                    >
                      ↑
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      className="h-9 w-9 px-0"
                      aria-label={t('moveDown', { title: milestone.title })}
                      disabled={pendingId !== null || index === orderedMilestones.length - 1}
                      onClick={() => void handleReorder(milestone, 'down')}
                    >
                      ↓
                    </Button>
                    <form onSubmit={(event) => {
                      event.preventDefault();
                      void handleDelete(milestone);
                    }}>
                      <ConfirmSubmitButton
                        confirmText={t('milestones.deleteConfirm')}
                        disabled={pendingId !== null}
                        className="h-9 rounded-pill border border-red-400/30 px-3 text-xs text-red-200 transition hover:bg-red-500/10 disabled:opacity-60"
                      >
                        {pendingId === milestone.id ? t('deleting') : t('milestones.delete')}
                      </ConfirmSubmitButton>
                    </form>
                  </div>
                </div>
                <div className="mt-4 border-s-2 border-glass-border ps-4">
                  <TaskList goalId={goalId} milestoneId={milestone.id} tasks={milestoneTasks} />
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
