'use client';

import { useTranslations } from 'next-intl';
import { Alert } from '@/components/ui/Alert';
import { Card } from '@/components/ui/Card';
import { DreamCard } from '@/components/roadmap/DreamCard';
import { GoalCard } from '@/components/roadmap/GoalCard';
import { DreamCreateForm, GoalCreateForm } from '@/components/roadmap/RoadmapForms';
import type {
  RoadmapDream,
  RoadmapGoal,
  RoadmapMilestone,
  RoadmapTask,
} from '@/lib/validation/roadmap';

export function RoadmapClient({
  dreams,
  goals,
  milestones,
  tasks,
  loadError,
}: {
  dreams: RoadmapDream[];
  goals: RoadmapGoal[];
  milestones: RoadmapMilestone[];
  tasks: RoadmapTask[];
  loadError: boolean;
}) {
  const t = useTranslations('roadmap');
  const unassignedGoals = goals.filter((goal) => goal.dream_id === null);

  return (
    <div className="space-y-6">
      {loadError && <Alert>{t('errors.load_failed')}</Alert>}
      <DreamCreateForm />
      <GoalCreateForm dreams={dreams} />

      <section className="space-y-4" aria-labelledby="dreams-heading">
        <h2 id="dreams-heading" className="font-heading text-2xl font-semibold">
          {t('dreams.listTitle')}
        </h2>
        {dreams.length === 0 ? (
          <Card><p className="text-sm text-muted">{t('dreams.empty')}</p></Card>
        ) : (
          dreams.map((dream) => (
            <DreamCard
              key={dream.id}
              dream={dream}
              goals={goals.filter((goal) => goal.dream_id === dream.id)}
              milestones={milestones}
              tasks={tasks}
            />
          ))
        )}
      </section>

      {unassignedGoals.length > 0 && (
        <section className="space-y-4" aria-labelledby="unassigned-goals-heading">
          <h2 id="unassigned-goals-heading" className="font-heading text-2xl font-semibold">
            {t('goals.unassignedTitle')}
          </h2>
          <div className="space-y-4">
            {unassignedGoals.map((goal) => (
              <GoalCard
                key={goal.id}
                goal={goal}
                milestones={milestones.filter((milestone) => milestone.goal_id === goal.id)}
                tasks={tasks.filter((task) => task.goal_id === goal.id)}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
