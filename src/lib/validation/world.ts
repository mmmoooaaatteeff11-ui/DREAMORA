import { z } from 'zod';

export const worldProfileSchema = z
  .object({
    heroName: z.string().trim().max(16).transform((value) => value || null),
    heroGender: z.enum(['m', 'f']),
    heroSkin: z.coerce.number().int().min(0).max(3),
    heroHair: z.coerce.number().int().min(0).max(3),
    heroShirt: z.coerce.number().int().min(0).max(3),
    companionName: z.string().trim().max(16).transform((value) => value || null),
    companionGender: z.enum(['m', 'f']),
    companionForm: z.enum(['nur', 'fox', 'spirit']),
    companionTint: z.coerce.number().int().min(0).max(3),
    voiceEnabled: z.boolean(),
  })
  .strict();

export type WorldProfile = {
  heroName: string;
  heroGender: 'm' | 'f';
  heroSkin: number;
  heroHair: number;
  heroShirt: number;
  companionName: string;
  companionGender: 'm' | 'f';
  companionForm: 'nur' | 'fox' | 'spirit';
  companionTint: number;
  voiceEnabled: boolean;
};

export type WorldGoal = { id: string; title: string };

export type WorldObstacle = {
  id: string;
  goal_id: string | null;
  title: string;
  kind: 'time' | 'fear' | 'energy' | 'other';
  status: 'open' | 'overcome';
  how_overcome: string | null;
};

export type WorldStep = {
  id: string;
  obstacle_id: string;
  title: string;
  completed_at: string | null;
};
