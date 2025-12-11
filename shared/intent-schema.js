import { z } from 'zod';
export const IntentKind = z.enum(['move', 'combat_action', 'dialogue', 'quest_action', 'system_event']);
export const IntentSchema = z.object({
    kind: IntentKind,
    characterId: z.string().optional(),
    payload: z.record(z.any(), z.any()).optional()
});
