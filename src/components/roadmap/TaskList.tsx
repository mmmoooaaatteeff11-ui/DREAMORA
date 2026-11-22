'use client';

import { useState, type FormEvent } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Alert } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ConfirmSubmitButton } from '@/components/ui/ConfirmSubmitButton';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { useRouter } from '@/i18n/navigation';
import { TASK_CADENCES, type RoadmapTask, type TaskCadence } from '@/lib/validation/roadmap';
import { createTask, deleteTask, reorderTask, toggleTask } from '@/server/services/roadmap';

export function TaskList({
  goalId,
  milestoneId,
  tasks,
}: {
  goalId: string;
  milestoneId: string | null;
  tasks: RoadmapTask[];
}) {
  const t = useTranslations('roadmap');
  const locale = useLocale();
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [cadence, setCadence] = useState<TaskCadence>('once');
  const [dueDate, setDueDate] = useState('');
  const [saving, setSaving] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);

  const orderedTasks = [...tasks].sort((a, b) =>
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
      const result = await createTask({
        goalId,
        milestoneId,
        title,
        cadence,
        dueDate: dueDate || null,
      });
      if (result.status === 'success') {
        setTitle('');
        setCadence('once');
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

  async function handleToggle(task: RoadmapTask, completed: boolean) {
    setPendingId(task.id);
    setErrorCode(null);
    try {
      const result = await toggleTask({ id: task.id, goalId, completed });
      if (result.status === 'success') router.refresh();
      else setErrorCode(result.code);
    } catch {
      setErrorCode('generic');
    } finally {
      setPendingId(null);
    }
  }

  async function handleReorder(task: RoadmapTask, direction: 'up' | 'down') {
    setPendingId(task.id);
    setErrorCode(null);
    try {
      const result = await reorderTask({ id: task.id, goalId, milestoneId, direction });
      if (result.status === 'success') router.refresh();
      else setErrorCode(result.code);
    } catch {
      setErrorCode('generic');
    } finally {
      setPendingId(null);
    }
  }

  async function handleDelete(task: RoadmapTask) {
    setPendingId(task.id);
    setErrorCode(null);
    try {
      const result = await deleteTask({ id: task.id, goalId });
      if (result.status === 'success') router.refresh();
      else setErrorCode(result.code);
    } catch {
      setErrorCode('generic');
    } finally {
      setPendingId(null);
    }
  }

  return (
    <div className="space-y-3">
      <h4 className="font-medium">{t('tasks.title')}</h4>
      <form onSubmit={handleCreate} className="grid gap-3 rounded-xl border border-glass-border p-3 sm:grid-cols-2">
        <Input
          name={`taskTitle-${goalId}-${milestoneId ?? 'goal'}`}
          label={t('tasks.titleLabel')}
          value={title}
          maxLength={200}
          required
          onChange={(event) => setTitle(event.target.value)}
        />
        <Select
          name={`taskCadence-${goalId}-${milestoneId ?? 'goal'}`}
          label={t('tasks.cadenceLabel')}
          value={cadence}
          onChange={(event) => setCadence(event.target.value as TaskCadence)}
        >
          {TASK_CADENCES.map((value) => (
            <option key={value} value={value} className="bg-[#171322]">{t(`cadences.${value}`)}</option>
          ))}
        </Select>
        <div className="space-y-1.5">
          <label htmlFor={`task-date-${goalId}-${milestoneId ?? 'goal'}`} className="block text-sm font-medium text-ink">
            {t('tasks.dueDateLabel')}
          </label>
          <input
            id={`task-date-${goalId}-${milestoneId ?? 'goal'}`}
            type="date"
            value={dueDate}
            onChange={(event) => setDueDate(event.target.value)}
            className="h-12 w-full rounded-xl border border-glass-border bg-glass px-4 text-ink outline-none focus:border-primary-light"
          />
        </div>
        <Button type="submit" loading={saving} className="self-end">{t('tasks.add')}</Button>
      </form>

      {errorCode && <Alert>{t(`errors.${errorCode}`)}</Alert>}
      {orderedTasks.length === 0 ? (
        <p className="text-sm text-muted">{t('tasks.empty')}</p>
      ) : (
        <ul className="space-y-2">
          {orderedTasks.map((task, index) => (
            <li key={task.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-glass-border px-3 py-2">
              <input
                type="checkbox"
                checked={task.completed_at !== null}
                disabled={pendingId !== null}
                aria-label={t('tasks.toggle', { title: task.title })}
                onChange={(event) => void handleToggle(task, event.target.checked)}
                className="h-4 w-4 accent-violet-500"
              />
              <div className="min-w-0 flex-1">
                <p className={`break-words text-sm ${task.completed_at ? 'text-muted line-through' : 'text-ink'}`}>
                  {task.title}
                </p>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <Badge>{t(`cadences.${task.cadence}`)}</Badge>
                  {task.due_date && <span className="text-xs text-muted">{formatDate(task.due_date)}</span>}
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  className="h-9 w-9 px-0"
                  aria-label={t('moveUp', { title: task.title })}
                  disabled={pendingId !== null || index === 0}
                  onClick={() => void handleReorder(task, 'up')}
                >
                  ↑
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className="h-9 w-9 px-0"
                  aria-label={t('moveDown', { title: task.title })}
                  disabled={pendingId !== null || index === orderedTasks.length - 1}
                  onClick={() => void handleReorder(task, 'down')}
                >
                  ↓
                </Button>
                <form onSubmit={(event) => {
                  event.preventDefault();
                  void handleDelete(task);
                }}>
                  <ConfirmSubmitButton
                    confirmText={t('tasks.deleteConfirm')}
                    disabled={pendingId !== null}
                    className="h-9 rounded-pill border border-red-400/30 px-3 text-xs text-red-200 transition hover:bg-red-500/10 disabled:opacity-60"
                  >
                    {pendingId === task.id ? t('deleting') : t('tasks.delete')}
                  </ConfirmSubmitButton>
                </form>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
