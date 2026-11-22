'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import {
  createDreamSchema,
  createGoalSchema,
  createMilestoneSchema,
  createTaskSchema,
  milestoneActionSchema,
  roadmapIdSchema,
  reorderMilestoneSchema,
  reorderTaskSchema,
  taskActionSchema,
  toggleMilestoneSchema,
  toggleTaskSchema,
  updateGoalSchema,
} from '@/lib/validation/roadmap';

type RoadmapResult = { status: 'success' } | { status: 'error'; code: string };
type CreatedResult = RoadmapResult | { status: 'success'; id: string };

async function getContext() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { status: 'error' as const, code: 'session_expired' };
  return { status: 'success' as const, supabase, user };
}

function finish(result: RoadmapResult) {
  if (result.status === 'success') revalidatePath('/', 'layout');
  return result;
}

export async function createDream(input: unknown): Promise<CreatedResult> {
  const parsed = createDreamSchema.safeParse(input);
  if (!parsed.success) return { status: 'error', code: 'validation' };

  const context = await getContext();
  if (context.status === 'error') return context;

  const { data, error } = await context.supabase
    .from('dreams')
    .insert({ user_id: context.user.id, title: parsed.data.title })
    .select('id')
    .single();
  if (error) return { status: 'error', code: 'generic' };

  revalidatePath('/', 'layout');
  return { status: 'success', id: data.id };
}

export async function deleteDream(input: unknown): Promise<RoadmapResult> {
  const parsed = roadmapIdSchema.safeParse(input);
  if (!parsed.success) return { status: 'error', code: 'validation' };

  const context = await getContext();
  if (context.status === 'error') return context;
  const { data, error } = await context.supabase
    .from('dreams')
    .delete()
    .eq('id', parsed.data.id)
    .eq('user_id', context.user.id)
    .select('id')
    .maybeSingle();
  if (error) return { status: 'error', code: 'generic' };
  if (!data) return { status: 'error', code: 'not_found' };
  return finish({ status: 'success' });
}

export async function createGoal(input: unknown): Promise<CreatedResult> {
  const parsed = createGoalSchema.safeParse(input);
  if (!parsed.success) return { status: 'error', code: 'validation' };

  const context = await getContext();
  if (context.status === 'error') return context;
  if (parsed.data.dreamId) {
    const { data: dream, error } = await context.supabase
      .from('dreams')
      .select('id')
      .eq('id', parsed.data.dreamId)
      .eq('user_id', context.user.id)
      .maybeSingle();
    if (error) return { status: 'error', code: 'generic' };
    if (!dream) return { status: 'error', code: 'not_found' };
  }

  const { data, error } = await context.supabase
    .from('goals')
    .insert({
      user_id: context.user.id,
      dream_id: parsed.data.dreamId,
      title: parsed.data.title,
      description: parsed.data.description || null,
      deadline: parsed.data.deadline,
      status: parsed.data.status,
    })
    .select('id')
    .single();
  if (error) return { status: 'error', code: 'generic' };

  revalidatePath('/', 'layout');
  return { status: 'success', id: data.id };
}

export async function updateGoal(input: unknown): Promise<RoadmapResult> {
  const parsed = updateGoalSchema.safeParse(input);
  if (!parsed.success) return { status: 'error', code: 'validation' };

  const context = await getContext();
  if (context.status === 'error') return context;
  const { id, ...fields } = parsed.data;
  const { data, error } = await context.supabase
    .from('goals')
    .update({
      title: fields.title,
      description: fields.description || null,
      deadline: fields.deadline,
      status: fields.status,
    })
    .eq('id', id)
    .eq('user_id', context.user.id)
    .select('id')
    .maybeSingle();
  if (error) return { status: 'error', code: 'generic' };
  if (!data) return { status: 'error', code: 'not_found' };
  return finish({ status: 'success' });
}

export async function deleteGoal(input: unknown): Promise<RoadmapResult> {
  const parsed = roadmapIdSchema.safeParse(input);
  if (!parsed.success) return { status: 'error', code: 'validation' };

  const context = await getContext();
  if (context.status === 'error') return context;
  const { data, error } = await context.supabase
    .from('goals')
    .delete()
    .eq('id', parsed.data.id)
    .eq('user_id', context.user.id)
    .select('id')
    .maybeSingle();
  if (error) return { status: 'error', code: 'generic' };
  if (!data) return { status: 'error', code: 'not_found' };
  return finish({ status: 'success' });
}

export async function createMilestone(input: unknown): Promise<RoadmapResult> {
  const parsed = createMilestoneSchema.safeParse(input);
  if (!parsed.success) return { status: 'error', code: 'validation' };

  const context = await getContext();
  if (context.status === 'error') return context;
  const { data: goal, error: goalError } = await context.supabase
    .from('goals')
    .select('id')
    .eq('id', parsed.data.goalId)
    .eq('user_id', context.user.id)
    .maybeSingle();
  if (goalError) return { status: 'error', code: 'generic' };
  if (!goal) return { status: 'error', code: 'not_found' };

  const { data: last, error: positionError } = await context.supabase
    .from('milestones')
    .select('position')
    .eq('user_id', context.user.id)
    .eq('goal_id', parsed.data.goalId)
    .order('position', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (positionError) return { status: 'error', code: 'generic' };
  const position = (last?.position ?? -1) + 1;
  if (position > 32767) return { status: 'error', code: 'position_limit' };

  const { error } = await context.supabase.from('milestones').insert({
    user_id: context.user.id,
    goal_id: parsed.data.goalId,
    title: parsed.data.title,
    due_date: parsed.data.dueDate,
    position,
  });
  if (error) return { status: 'error', code: 'generic' };
  return finish({ status: 'success' });
}

export async function toggleMilestone(input: unknown): Promise<RoadmapResult> {
  const parsed = toggleMilestoneSchema.safeParse(input);
  if (!parsed.success) return { status: 'error', code: 'validation' };

  const context = await getContext();
  if (context.status === 'error') return context;
  const { data, error } = await context.supabase
    .from('milestones')
    .update({ completed_at: parsed.data.completed ? new Date().toISOString() : null })
    .eq('id', parsed.data.id)
    .eq('goal_id', parsed.data.goalId)
    .eq('user_id', context.user.id)
    .select('id')
    .maybeSingle();
  if (error) return { status: 'error', code: 'generic' };
  if (!data) return { status: 'error', code: 'not_found' };
  return finish({ status: 'success' });
}

export async function deleteMilestone(input: unknown): Promise<RoadmapResult> {
  const parsed = milestoneActionSchema.safeParse(input);
  if (!parsed.success) return { status: 'error', code: 'validation' };

  const context = await getContext();
  if (context.status === 'error') return context;
  const { data, error } = await context.supabase
    .from('milestones')
    .delete()
    .eq('id', parsed.data.id)
    .eq('goal_id', parsed.data.goalId)
    .eq('user_id', context.user.id)
    .select('id')
    .maybeSingle();
  if (error) return { status: 'error', code: 'generic' };
  if (!data) return { status: 'error', code: 'not_found' };
  return finish({ status: 'success' });
}

export async function reorderMilestone(input: unknown): Promise<RoadmapResult> {
  const parsed = reorderMilestoneSchema.safeParse(input);
  if (!parsed.success) return { status: 'error', code: 'validation' };

  const context = await getContext();
  if (context.status === 'error') return context;
  const { data: rows, error } = await context.supabase
    .from('milestones')
    .select('id,position,created_at')
    .eq('goal_id', parsed.data.goalId)
    .eq('user_id', context.user.id)
    .order('position', { ascending: true })
    .order('created_at', { ascending: true });
  if (error) return { status: 'error', code: 'generic' };

  const ordered = [...(rows ?? [])];
  if (ordered.length > 32768) return { status: 'error', code: 'position_limit' };
  const index = ordered.findIndex((row) => row.id === parsed.data.id);
  const neighbor = parsed.data.direction === 'up' ? index - 1 : index + 1;
  if (index < 0) return { status: 'error', code: 'not_found' };
  if (neighbor < 0 || neighbor >= ordered.length) return { status: 'success' };
  [ordered[index], ordered[neighbor]] = [ordered[neighbor], ordered[index]];

  for (const [position, row] of ordered.entries()) {
    const { error: updateError } = await context.supabase
      .from('milestones')
      .update({ position })
      .eq('id', row.id)
      .eq('goal_id', parsed.data.goalId)
      .eq('user_id', context.user.id);
    if (updateError) return { status: 'error', code: 'generic' };
  }
  return finish({ status: 'success' });
}

export async function createTask(input: unknown): Promise<RoadmapResult> {
  const parsed = createTaskSchema.safeParse(input);
  if (!parsed.success) return { status: 'error', code: 'validation' };

  const context = await getContext();
  if (context.status === 'error') return context;
  const { data: goal, error: goalError } = await context.supabase
    .from('goals')
    .select('id')
    .eq('id', parsed.data.goalId)
    .eq('user_id', context.user.id)
    .maybeSingle();
  if (goalError) return { status: 'error', code: 'generic' };
  if (!goal) return { status: 'error', code: 'not_found' };

  if (parsed.data.milestoneId) {
    const { data: milestone, error: milestoneError } = await context.supabase
      .from('milestones')
      .select('id')
      .eq('id', parsed.data.milestoneId)
      .eq('goal_id', parsed.data.goalId)
      .eq('user_id', context.user.id)
      .maybeSingle();
    if (milestoneError) return { status: 'error', code: 'generic' };
    if (!milestone) return { status: 'error', code: 'not_found' };
  }

  let positionQuery = context.supabase
    .from('tasks')
    .select('position')
    .eq('user_id', context.user.id)
    .eq('goal_id', parsed.data.goalId);
  positionQuery = parsed.data.milestoneId
    ? positionQuery.eq('milestone_id', parsed.data.milestoneId)
    : positionQuery.is('milestone_id', null);
  const { data: last, error: positionError } = await positionQuery
    .order('position', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (positionError) return { status: 'error', code: 'generic' };
  const position = (last?.position ?? -1) + 1;
  if (position > 32767) return { status: 'error', code: 'position_limit' };

  const { error } = await context.supabase.from('tasks').insert({
    user_id: context.user.id,
    goal_id: parsed.data.goalId,
    milestone_id: parsed.data.milestoneId,
    title: parsed.data.title,
    cadence: parsed.data.cadence,
    due_date: parsed.data.dueDate,
    position,
  });
  if (error) return { status: 'error', code: 'generic' };
  return finish({ status: 'success' });
}

export async function toggleTask(input: unknown): Promise<RoadmapResult> {
  const parsed = toggleTaskSchema.safeParse(input);
  if (!parsed.success) return { status: 'error', code: 'validation' };

  const context = await getContext();
  if (context.status === 'error') return context;
  const { data, error } = await context.supabase
    .from('tasks')
    .update({ completed_at: parsed.data.completed ? new Date().toISOString() : null })
    .eq('id', parsed.data.id)
    .eq('goal_id', parsed.data.goalId)
    .eq('user_id', context.user.id)
    .select('id')
    .maybeSingle();
  if (error) return { status: 'error', code: 'generic' };
  if (!data) return { status: 'error', code: 'not_found' };
  return finish({ status: 'success' });
}

export async function deleteTask(input: unknown): Promise<RoadmapResult> {
  const parsed = taskActionSchema.safeParse(input);
  if (!parsed.success) return { status: 'error', code: 'validation' };

  const context = await getContext();
  if (context.status === 'error') return context;
  const { data, error } = await context.supabase
    .from('tasks')
    .delete()
    .eq('id', parsed.data.id)
    .eq('goal_id', parsed.data.goalId)
    .eq('user_id', context.user.id)
    .select('id')
    .maybeSingle();
  if (error) return { status: 'error', code: 'generic' };
  if (!data) return { status: 'error', code: 'not_found' };
  return finish({ status: 'success' });
}

export async function reorderTask(input: unknown): Promise<RoadmapResult> {
  const parsed = reorderTaskSchema.safeParse(input);
  if (!parsed.success) return { status: 'error', code: 'validation' };

  const context = await getContext();
  if (context.status === 'error') return context;
  let query = context.supabase
    .from('tasks')
    .select('id,position,created_at')
    .eq('goal_id', parsed.data.goalId)
    .eq('user_id', context.user.id);
  query = parsed.data.milestoneId
    ? query.eq('milestone_id', parsed.data.milestoneId)
    : query.is('milestone_id', null);
  const { data: rows, error } = await query
    .order('position', { ascending: true })
    .order('created_at', { ascending: true });
  if (error) return { status: 'error', code: 'generic' };

  const ordered = [...(rows ?? [])];
  if (ordered.length > 32768) return { status: 'error', code: 'position_limit' };
  const index = ordered.findIndex((row) => row.id === parsed.data.id);
  const neighbor = parsed.data.direction === 'up' ? index - 1 : index + 1;
  if (index < 0) return { status: 'error', code: 'not_found' };
  if (neighbor < 0 || neighbor >= ordered.length) return { status: 'success' };
  [ordered[index], ordered[neighbor]] = [ordered[neighbor], ordered[index]];

  for (const [position, row] of ordered.entries()) {
    const { error: updateError } = await context.supabase
      .from('tasks')
      .update({ position })
      .eq('id', row.id)
      .eq('goal_id', parsed.data.goalId)
      .eq('user_id', context.user.id);
    if (updateError) return { status: 'error', code: 'generic' };
  }
  return finish({ status: 'success' });
}
