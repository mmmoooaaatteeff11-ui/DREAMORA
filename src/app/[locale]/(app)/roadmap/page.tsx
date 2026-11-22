import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { RoadmapClient } from '@/components/roadmap/RoadmapClient';
import { createClient } from '@/lib/supabase/server';
import { redirect } from '@/i18n/navigation';
import type {
  RoadmapDream,
  RoadmapGoal,
  RoadmapMilestone,
  RoadmapTask,
} from '@/lib/validation/roadmap';

export async function generateMetadata({
  params: { locale },
}: {
  params: { locale: string };
}): Promise<Metadata> {
  const t = await getTranslations({ locale, namespace: 'roadmap' });
  return { title: t('metaTitle') };
}

export default async function RoadmapPage({ params: { locale } }: { params: { locale: string } }) {
  setRequestLocale(locale);

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return redirect({ href: '/login', locale });

  const [dreamsResult, goalsResult, milestonesResult, tasksResult] = await Promise.all([
    supabase
      .from('dreams')
      .select('id,title,created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false }),
    supabase
      .from('goals')
      .select('id,dream_id,title,description,deadline,status,progress,created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false }),
    supabase
      .from('milestones')
      .select('id,goal_id,title,due_date,completed_at,position,created_at')
      .eq('user_id', user.id)
      .order('position', { ascending: true })
      .order('created_at', { ascending: true }),
    supabase
      .from('tasks')
      .select('id,goal_id,milestone_id,title,cadence,due_date,completed_at,position,created_at')
      .eq('user_id', user.id)
      .order('position', { ascending: true })
      .order('created_at', { ascending: true }),
  ]);
  const t = await getTranslations('roadmap');

  return (
    <main className="mx-auto w-full max-w-4xl space-y-6 px-4 py-8">
      <header className="space-y-2">
        <h1 className="font-heading text-3xl font-semibold sm:text-4xl">{t('title')}</h1>
        <p className="max-w-2xl text-muted">{t('description')}</p>
      </header>
      <RoadmapClient
        dreams={(dreamsResult.data ?? []) as RoadmapDream[]}
        goals={(goalsResult.data ?? []) as RoadmapGoal[]}
        milestones={(milestonesResult.data ?? []) as RoadmapMilestone[]}
        tasks={(tasksResult.data ?? []) as RoadmapTask[]}
        loadError={Boolean(
          dreamsResult.error || goalsResult.error || milestonesResult.error || tasksResult.error,
        )}
      />
    </main>
  );
}
