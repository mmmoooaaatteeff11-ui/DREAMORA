import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { redirect } from '@/i18n/navigation';
import { createClient } from '@/lib/supabase/server';
import type { WorldGoal, WorldObstacle, WorldProfile, WorldStep } from '@/lib/validation/world';
import { WorldPageClient } from '@/components/world/WorldPageClient';
import '@/components/world/world-theme.css';

export async function generateMetadata({
  params: { locale },
}: {
  params: { locale: string };
}): Promise<Metadata> {
  const t = await getTranslations({ locale, namespace: 'world' });
  return { title: t('metaTitle') };
}

const EMPTY_PROFILE: WorldProfile = {
  heroName: '',
  heroGender: 'm',
  heroSkin: 0,
  heroHair: 0,
  heroShirt: 0,
  companionName: '',
  companionGender: 'f',
  companionForm: 'nur',
  companionTint: 0,
  voiceEnabled: false,
};

export default async function WorldPage({ params: { locale } }: { params: { locale: string } }) {
  setRequestLocale(locale);

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return redirect({ href: '/login', locale });

  const [profileResult, goalsResult, obstaclesResult, stepsResult, moodResult] = await Promise.all([
    supabase
      .from('world_profiles')
      .select(
        'hero_name,hero_gender,hero_skin,hero_hair,hero_shirt,companion_name,companion_gender,companion_form,companion_tint,voice_enabled',
      )
      .eq('user_id', user.id)
      .maybeSingle(),
    supabase.from('goals').select('id,title').eq('user_id', user.id).eq('status', 'active').order('created_at'),
    supabase
      .from('goal_obstacles')
      .select('id,goal_id,title,kind,status,how_overcome')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true }),
    supabase
      .from('obstacle_steps')
      .select('id,obstacle_id,title,completed_at')
      .eq('user_id', user.id)
      .order('position', { ascending: true }),
    supabase
      .from('mood_entries')
      .select('mood_key')
      .eq('user_id', user.id)
      .order('entry_date', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const profile = profileResult.data
    ? {
        heroName: profileResult.data.hero_name ?? '',
        heroGender: profileResult.data.hero_gender,
        heroSkin: profileResult.data.hero_skin,
        heroHair: profileResult.data.hero_hair,
        heroShirt: profileResult.data.hero_shirt,
        companionName: profileResult.data.companion_name ?? '',
        companionGender: profileResult.data.companion_gender,
        companionForm: profileResult.data.companion_form,
        companionTint: profileResult.data.companion_tint,
        voiceEnabled: profileResult.data.voice_enabled,
      }
    : EMPTY_PROFILE;
  const goals = (goalsResult.data ?? []) as WorldGoal[];
  const obstacles = (obstaclesResult.data ?? []) as WorldObstacle[];
  const steps = (stepsResult.data ?? []) as WorldStep[];
  const loadError = Boolean(
    profileResult.error ||
      goalsResult.error ||
      obstaclesResult.error ||
      stepsResult.error ||
      moodResult.error,
  );

  return (
    <div className="world-theme min-h-0">
      <WorldPageClient
        profile={profile}
        goals={goals}
        obstacles={obstacles}
        steps={steps}
        moodKey={moodResult.data?.mood_key ?? null}
        loadError={loadError}
      />
    </div>
  );
}
