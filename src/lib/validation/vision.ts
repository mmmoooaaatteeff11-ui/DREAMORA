import { z } from 'zod';

export const VISION_KINDS = ['text', 'quote', 'emoji'] as const;
export const VISION_COLORS = [
  '#4F46E5',
  '#0369A1',
  '#0F766E',
  '#9A3412',
  '#9D174D',
  '#4D7C0F',
  '#6D28D9',
  '#A16207',
] as const;

export const visionItemSchema = z
  .object({
    kind: z.enum(VISION_KINDS),
    content: z.string().trim().min(1).max(300),
    emoji: z.string().max(16).optional(),
    color: z.enum(VISION_COLORS),
    size: z.number().int().min(1).max(3),
  })
  .strict();

export const visionIdSchema = z.object({ id: z.string().uuid() }).strict();
export const updateVisionPositionSchema = z
  .object({
    id: z.string().uuid(),
    x: z.number().finite().min(0).max(100),
    y: z.number().finite().min(0).max(100),
  })
  .strict();

export type VisionKind = (typeof VISION_KINDS)[number];
export type VisionColor = (typeof VISION_COLORS)[number];

export type VisionItem = {
  id: string;
  kind: VisionKind;
  content: string;
  emoji: string | null;
  color: string | null;
  x: number;
  y: number;
  z: number;
  size: number;
};
