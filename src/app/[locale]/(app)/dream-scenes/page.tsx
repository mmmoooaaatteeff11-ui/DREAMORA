import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { z } from 'zod';
import { redirect } from '@/i18n/navigation';
import { createClient } from '@/lib/supabase/server';
import { DreamScenesClient, type SavedDreamScene } from '@/components/dream-scenes/DreamScenesClient';

type SceneRow = {
  id: string;
  run_id: string;
  scene_number: number;
  dream: string;
  scene_text: string;
  choices: unknown;
  first_step: string;
  created_at: string;
};

function toSavedScene(row: SceneRow): SavedDreamScene {
  const choices = Array.isArray(row.choices)
    ? row.choices.filter((choice): choice is string => typeof choice === 'string')
    : [];
  return {
    id: row.id,
    runId: row.run_id,
    sceneNumber: row.scene_number,
    dream: row.dream,
    sceneText: row.scene_text,
    choices,
    firstStep: row.first_step,
    createdAt: row.created_at,
  };
}

export async function generateMetadata({
  params: { locale },
}: {
  params: { locale: string };
}): Promise<Metadata> {
  const t = await getTranslations({ locale, namespace: 'dreamScenes' });
  return { title: t('metaTitle') };
}

export default async function DreamScenesPage({
  params: { locale },
  searchParams,
}: {
  params: { locale: string };
  searchParams?: { run?: string | string[] };
}) {
  setRequestLocale(locale);

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return redirect({ href: '/login', locale });

  const { data: rows, error: historyError } = await supabase
    .from('dream_scene_turns')
    .select('id, run_id, scene_number, dream, scene_text, choices, first_step, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(100);

  if (historyError) console.error('[dream-scenes] history query failed', historyError.code);

  const latestByRun = new Map<string, SavedDreamScene>();
  for (const rawRow of rows ?? []) {
    const row = rawRow as SceneRow;
    if (!latestByRun.has(row.run_id)) latestByRun.set(row.run_id, toSavedScene(row));
  }
  const sessions = [...latestByRun.values()];

  const runParam = Array.isArray(searchParams?.run) ? searchParams?.run[0] : searchParams?.run;
  const parsedRunId = runParam ? z.string().uuid().safeParse(runParam) : null;
  const requestedRunId = parsedRunId?.success ? parsedRunId.data : null;
  let initialScene = requestedRunId ? sessions.find((session) => session.runId === requestedRunId) ?? null : null;
  let selectedSceneError = false;

  if (requestedRunId && !initialScene && !historyError) {
    const { data: row, error } = await supabase
      .from('dream_scene_turns')
      .select('id, run_id, scene_number, dream, scene_text, choices, first_step, created_at')
      .eq('user_id', user.id)
      .eq('run_id', requestedRunId)
      .order('scene_number', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      selectedSceneError = true;
      console.error('[dream-scenes] selected scene query failed', error.code);
    }
    if (row) initialScene = toSavedScene(row as SceneRow);
  }

  return (
    <DreamScenesClient
      locale={locale === 'en' ? 'en' : 'ar'}
      initialScene={initialScene}
      sessions={sessions}
      loadError={Boolean(historyError || selectedSceneError)}
      runNotFound={Boolean(requestedRunId && !initialScene && !historyError && !selectedSceneError)}
    />
  );
}
