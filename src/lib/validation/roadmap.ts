import { z } from 'zod';

export const GOAL_STATUSES = ['active', 'completed', 'paused', 'archived'] as const;
export const TASK_CADENCES = ['once', 'daily', 'weekly'] as const;

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
});

const nullableDateSchema = dateSchema.nullable();

export const createDreamSchema = z.object({
  title: z.string().trim().min(1).max(200),
}).strict();
export const roadmapIdSchema = z.object({ id: z.string().uuid() }).strict();

const goalFieldsSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().nullable(),
  deadline: nullableDateSchema,
  status: z.enum(GOAL_STATUSES),
}).strict();

export const createGoalSchema = goalFieldsSchema.extend({
  dreamId: z.string().uuid().nullable(),
});
export const updateGoalSchema = goalFieldsSchema.extend({
  id: z.string().uuid(),
});

export const createMilestoneSchema = z.object({
  goalId: z.string().uuid(),
  title: z.string().trim().min(1).max(200),
  dueDate: nullableDateSchema,
}).strict();
export const milestoneActionSchema = z.object({
  id: z.string().uuid(),
  goalId: z.string().uuid(),
}).strict();
export const toggleMilestoneSchema = milestoneActionSchema.extend({
  completed: z.boolean(),
});
export const reorderMilestoneSchema = milestoneActionSchema.extend({
  direction: z.enum(['up', 'down']),
});

export const createTaskSchema = z.object({
  goalId: z.string().uuid(),
  milestoneId: z.string().uuid().nullable(),
  title: z.string().trim().min(1).max(200),
  cadence: z.enum(TASK_CADENCES),
  dueDate: nullableDateSchema,
}).strict();
export const taskActionSchema = z.object({
  id: z.string().uuid(),
  goalId: z.string().uuid(),
}).strict();
export const toggleTaskSchema = taskActionSchema.extend({
  completed: z.boolean(),
});
export const reorderTaskSchema = taskActionSchema.extend({
  milestoneId: z.string().uuid().nullable(),
  direction: z.enum(['up', 'down']),
});

export type GoalStatus = (typeof GOAL_STATUSES)[number];
export type TaskCadence = (typeof TASK_CADENCES)[number];

export type RoadmapDream = {
  id: string;
  title: string;
  created_at: string;
};

export type RoadmapGoal = {
  id: string;
  dream_id: string | null;
  title: string;
  description: string | null;
  deadline: string | null;
  status: GoalStatus;
  progress: number;
  created_at: string;
};

export type RoadmapMilestone = {
  id: string;
  goal_id: string;
  title: string;
  due_date: string | null;
  completed_at: string | null;
  position: number;
  created_at: string;
};

export type RoadmapTask = {
  id: string;
  goal_id: string | null;
  milestone_id: string | null;
  title: string;
  cadence: TaskCadence;
  due_date: string | null;
  completed_at: string | null;
  position: number;
  created_at: string;
};
