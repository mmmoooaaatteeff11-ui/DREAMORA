'use client';

import { useState, type FormEvent } from 'react';
import { useTranslations } from 'next-intl';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { GOAL_STATUSES, type RoadmapDream, type RoadmapGoal, type GoalStatus } from '@/lib/validation/roadmap';
import { createDream, createGoal, updateGoal } from '@/server/services/roadmap';
import { useRouter } from '@/i18n/navigation';

export function DreamCreateForm() {
  const t = useTranslations('roadmap');
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setErrorCode(null);
    try {
      const result = await createDream({ title });
      if (result.status === 'success') {
        setTitle('');
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

  return (
    <Card>
      <h2 className="font-heading text-xl font-semibold">{t('dreams.title')}</h2>
      <form onSubmit={handleSubmit} className="mt-4 flex flex-wrap items-end gap-3">
        <div className="min-w-[min(100%,16rem)] flex-1">
          <Input
            name="dreamTitle"
            label={t('dreams.titleLabel')}
            value={title}
            maxLength={200}
            required
            onChange={(event) => setTitle(event.target.value)}
          />
        </div>
        <Button type="submit" loading={saving}>{t('dreams.add')}</Button>
      </form>
      {errorCode && <Alert className="mt-3">{t(`errors.${errorCode}`)}</Alert>}
    </Card>
  );
}

export function GoalCreateForm({ dreams }: { dreams: RoadmapDream[] }) {
  const t = useTranslations('roadmap');
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [deadline, setDeadline] = useState('');
  const [dreamId, setDreamId] = useState('');
  const [status, setStatus] = useState<GoalStatus>('active');
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setErrorCode(null);
    try {
      const result = await createGoal({
        title,
        description: description || null,
        deadline: deadline || null,
        dreamId: dreamId || null,
        status,
      });
      if (result.status === 'success') {
        setTitle('');
        setDescription('');
        setDeadline('');
        setDreamId('');
        setStatus('active');
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

  return (
    <Card>
      <h2 className="font-heading text-xl font-semibold">{t('goals.add')}</h2>
      <form onSubmit={handleSubmit} className="mt-4 space-y-4">
        <Input
          name="goalTitle"
          label={t('goals.titleLabel')}
          value={title}
          maxLength={200}
          required
          onChange={(event) => setTitle(event.target.value)}
        />
        <div className="space-y-1.5">
          <label htmlFor="goal-description" className="block text-sm font-medium text-ink">
            {t('goals.descriptionLabel')}
          </label>
          <textarea
            id="goal-description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            className="min-h-24 w-full resize-y rounded-xl border border-glass-border bg-glass px-4 py-3 text-ink outline-none focus:border-primary-light focus:ring-2 focus:ring-primary-light/40"
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-1.5">
            <label htmlFor="goal-deadline" className="block text-sm font-medium text-ink">
              {t('goals.deadlineLabel')}
            </label>
            <input
              id="goal-deadline"
              type="date"
              value={deadline}
              onChange={(event) => setDeadline(event.target.value)}
              className="h-12 w-full rounded-xl border border-glass-border bg-glass px-4 text-ink outline-none focus:border-primary-light"
            />
          </div>
          <Select
            name="goalStatus"
            label={t('goals.statusLabel')}
            value={status}
            onChange={(event) => setStatus(event.target.value as GoalStatus)}
          >
            {GOAL_STATUSES.map((value) => (
              <option key={value} value={value} className="bg-[#171322]">{t(`statuses.${value}`)}</option>
            ))}
          </Select>
          <Select
            name="goalDream"
            label={t('goals.dreamLabel')}
            value={dreamId}
            onChange={(event) => setDreamId(event.target.value)}
          >
            <option value="" className="bg-[#171322]">{t('goals.noDream')}</option>
            {dreams.map((dream) => (
              <option key={dream.id} value={dream.id} className="bg-[#171322]">{dream.title}</option>
            ))}
          </Select>
        </div>
        {errorCode && <Alert>{t(`errors.${errorCode}`)}</Alert>}
        <Button type="submit" loading={saving}>{t('goals.add')}</Button>
      </form>
    </Card>
  );
}

export function GoalEditForm({
  goal,
  onCancel,
  onSaved,
}: {
  goal: RoadmapGoal;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const t = useTranslations('roadmap');
  const [title, setTitle] = useState(goal.title);
  const [description, setDescription] = useState(goal.description ?? '');
  const [deadline, setDeadline] = useState(goal.deadline ?? '');
  const [status, setStatus] = useState<GoalStatus>(goal.status);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setErrorCode(null);
    try {
      const result = await updateGoal({
        id: goal.id,
        title,
        description: description || null,
        deadline: deadline || null,
        status,
      });
      if (result.status === 'success') onSaved();
      else setErrorCode(result.code);
    } catch {
      setErrorCode('generic');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-4 space-y-4 rounded-xl border border-glass-border p-4">
      <Input
        name="editGoalTitle"
        label={t('goals.titleLabel')}
        value={title}
        maxLength={200}
        required
        onChange={(event) => setTitle(event.target.value)}
      />
      <div className="space-y-1.5">
        <label htmlFor={`goal-description-${goal.id}`} className="block text-sm font-medium text-ink">
          {t('goals.descriptionLabel')}
        </label>
        <textarea
          id={`goal-description-${goal.id}`}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          className="min-h-24 w-full resize-y rounded-xl border border-glass-border bg-glass px-4 py-3 text-ink outline-none focus:border-primary-light focus:ring-2 focus:ring-primary-light/40"
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label htmlFor={`goal-deadline-${goal.id}`} className="block text-sm font-medium text-ink">
            {t('goals.deadlineLabel')}
          </label>
          <input
            id={`goal-deadline-${goal.id}`}
            type="date"
            value={deadline}
            onChange={(event) => setDeadline(event.target.value)}
            className="h-12 w-full rounded-xl border border-glass-border bg-glass px-4 text-ink outline-none focus:border-primary-light"
          />
        </div>
        <Select
          name={`editGoalStatus-${goal.id}`}
          label={t('goals.statusLabel')}
          value={status}
          onChange={(event) => setStatus(event.target.value as GoalStatus)}
        >
          {GOAL_STATUSES.map((value) => (
            <option key={value} value={value} className="bg-[#171322]">{t(`statuses.${value}`)}</option>
          ))}
        </Select>
      </div>
      {errorCode && <Alert>{t(`errors.${errorCode}`)}</Alert>}
      <div className="flex flex-wrap gap-3">
        <Button type="submit" loading={saving}>{t('goals.save')}</Button>
        <Button type="button" variant="ghost" disabled={saving} onClick={onCancel}>{t('cancel')}</Button>
      </div>
    </form>
  );
}
