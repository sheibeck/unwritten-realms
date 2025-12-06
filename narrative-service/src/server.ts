import Fastify from 'fastify';
import dotenv from 'dotenv';
import cors from '@fastify/cors';
import fetch from 'cross-fetch';
import { z } from 'zod';
import { IntentSchema } from '../../shared/intent-schema.js';
import { CharacterContextSchema, WorldContextSchema } from '../../shared/types.js';
import { loginWithGoogle } from './auth/auth-controller.js';

// Load environment variables from project root .env
dotenv.config({ path: '../../.env' });

const app = Fastify({ logger: true });

// Enable CORS for development
app.register(cors, {
    // Allow wildcard during local dev when CORS_ORIGIN='*'
    origin: (origin, cb) => {
        const cfg = process.env.CORS_ORIGIN || 'http://localhost:5173';
        if (cfg === '*') {
            cb(null, true);
            return;
        }
        const allowed = Array.isArray(cfg) ? cfg : cfg.split(',').map(s => s.trim());
        if (!origin || allowed.includes(origin)) {
            cb(null, true);
        } else {
            cb(new Error('Not allowed by CORS'), false);
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    strictPreflight: true
});

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

    const { text } = parsed.data as z.infer<typeof InterpretInputSchema>;

    // TODO: Replace with real OpenAI structured output call
    const intentGuess = IntentSchema.parse({ kind: guessIntent(text), payload: { text } });
    const narrative_output = generateNarrative(text, intentGuess.kind);

    // Forward to SpacetimeDB reducer (placeholder HTTP call)
    const stdbUrl = process.env.STDB_URL || 'http://localhost:3000';
    try {
        await fetch(`${stdbUrl}/apply_intent`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...(req.headers.authorization ? { Authorization: req.headers.authorization as string } : {}) },
            body: JSON.stringify(intentGuess)
        });
    } catch (e) {
        req.log.warn('Failed forwarding intent to SpacetimeDB');
    }

    return reply.send({ intent: intentGuess, narrative_output });
});

// Auth route: Google OAuth -> SpacetimeDB identity -> ensure_user
// Simple health check for auth endpoint
app.get('/auth/health', async (_req, reply) => {
    return reply.send({ status: 'ok' });
});

// Global health check
app.get('/health', async (_req, reply) => {
    return reply.send({ status: 'ok' });
});

// Root check
app.get('/', async (_req, reply) => {
    return reply.send({ status: 'ok' });
});

app.post('/auth/google', async (req, reply) => {
    try {
        const result = await loginWithGoogle(req as any, reply as any);
        // loginWithGoogle already writes response; return to satisfy Fastify
        return result;
    } catch (e) {
        req.log.error(e);
        return reply.code(500).send('Google login failed');
    }
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

// Print routes on readiness to verify registration
app.ready().then(() => {
    app.log.info(app.printRoutes());
});
