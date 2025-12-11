import { z } from 'zod';

export const ProfessionSchema = z.object({
    name: z.string(),
    lore: z.string(),
    mechanics: z.record(z.any())
});

export type Profession = z.infer<typeof ProfessionSchema>;
