import Fastify from 'fastify';
import fetch from 'cross-fetch';
import { z } from 'zod';
import { IntentSchema } from '../../shared/intent-schema.js';
import { CharacterContextSchema, WorldContextSchema } from '../../shared/types.js';

const app = Fastify({ logger: true });

const InterpretInputSchema = z.object({
    text: z.string(),
    character_context: CharacterContextSchema.optional(),
    world_context: WorldContextSchema.optional()
});

app.post('/interpret', async (req, reply) => {
    const parsed = InterpretInputSchema.safeParse(req.body as unknown);
    if (!parsed.success) {
        return reply.code(400).send({ error: parsed.error.message });
    }

    const { text } = parsed.data;

    // TODO: Replace with real OpenAI structured output call
    const intentGuess = IntentSchema.parse({ kind: guessIntent(text), payload: { text } });
    const narrative_output = generateNarrative(text, intentGuess.kind);

    // Forward to SpacetimeDB reducer (placeholder HTTP call)
    const stdbUrl = process.env.STDB_URL || 'http://localhost:3000';
    try {
        await fetch(`${stdbUrl}/apply_intent`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(intentGuess)
        });
    } catch (e) {
        req.log.warn('Failed forwarding intent to SpacetimeDB');
    }

    return reply.send({ intent: intentGuess, narrative_output });
});

function guessIntent(text: string): 'move' | 'combat_action' | 'dialogue' | 'quest_action' | 'system_event' {
    const t = text.toLowerCase();
    if (t.includes('move') || t.includes('go') || t.includes('walk')) return 'move';
    if (t.includes('attack') || t.includes('strike')) return 'combat_action';
    if (t.includes('say') || t.includes('talk')) return 'dialogue';
    if (t.includes('quest') || t.includes('collect')) return 'quest_action';
    return 'system_event';
}

function generateNarrative(text: string, kind: string) {
    return `You attempt to ${text} (${kind}).`;
}

const port = Number(process.env.PORT || 8081);
app.listen({ port, host: '0.0.0.0' }).catch(err => {
    app.log.error(err);
    process.exit(1);
});
