import { z } from 'zod';
export const NarrativeEventSchema = z.object({
    id: z.string(),
    character_id: z.string(),
    text: z.string(),
    intent_json: z.string(),
    timestamp: z.number()
});
