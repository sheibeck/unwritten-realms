import { z } from 'zod';
export const CharacterContextSchema = z.object({
    id: z.string(),
    name: z.string().optional(),
    class: z.string().optional(),
    stats: z.record(z.any()).optional()
});
export const WorldContextSchema = z.object({
    zone: z.string().optional(),
    time: z.string().optional(),
    weather: z.string().optional()
});
