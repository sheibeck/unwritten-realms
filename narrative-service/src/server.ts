import Fastify from 'fastify';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import cors from '@fastify/cors';
import fetch from 'cross-fetch';
import OpenAI from 'openai';
import { z } from 'zod';
import { IntentSchema } from '../../shared/intent-schema.js';
import { CharacterContextSchema, WorldContextSchema } from '../../shared/types.js';
import { ProfessionSchema } from '../../shared/profession.js';
import { loginWithGoogle } from './auth/auth-controller.js';

// Load environment variables from .env
// Try common locations to work both from project root and narrative-service folder
(() => {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const candidates = [
        // Try from current working directory (when running from narrative-service or repo root)
        path.resolve(process.cwd(), '.env'),
        path.resolve(process.cwd(), '../.env'),
        path.resolve(process.cwd(), '../../.env'),
        // Try relative to compiled file location in dist
        path.resolve(__dirname, '../.env'),
        path.resolve(__dirname, '../../.env'),
        path.resolve(__dirname, '../../../.env'),
        path.resolve(__dirname, '../../../../.env'),
    ];
    for (const p of candidates) {
        if (fs.existsSync(p)) {
            dotenv.config({ path: p });
            break;
        }
    }
})();

const app = Fastify({ logger: true });

// Enable CORS for development
app.register(cors, {
    // Allow wildcard during local dev when CORS_ORIGIN='*'
    origin: (origin, cb) => {
        // Default: permit both HTTP and HTTPS Vite dev origins.
        const cfg = process.env.CORS_ORIGIN || 'https://localhost:5173';
        if (cfg === '*') {
            cb(null, true);
            return;
        }
        const normalize = (s: string) => s.trim().replace(/\/$/, '');
        const allowed = Array.isArray(cfg) ? cfg.map(normalize) : cfg.split(',').map(normalize);
        const current = normalize(origin || '');
        if (!origin || allowed.includes(current)) {
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

    const { text, character_context, world_context } = parsed.data as z.infer<typeof InterpretInputSchema>;

    // Attempt to call OpenAI Responses API to get structured intent + narrative output
    let intentGuess: any = null;
    let narrative_output: string | null = null;

    try {
        const openaiKey = process.env.OPENAI_API_KEY;
        if (!openaiKey) throw new Error('OPENAI_API_KEY not configured');

        const client = new OpenAI({ apiKey: openaiKey });

        // Build a prompt asking for strict JSON with `intent` and `narrative_output` fields.
        const system = `You are a game assistant. When given player input and optional contexts, produce ONLY valid JSON that matches exactly this schema:\n` +
            `{\n` +
            `  "intent": {\n` +
            `    "kind": "move|combat_action|dialogue|quest_action|system_event|create_character",\n` +
            `    "characterId": "string (optional)",\n` +
            `    "payload": { /* object with intent-specific fields */ }\n` +
            `  },\n` +
            `  "narrative_output": "short string describing the result"\n` +
            `}\n\n` +
            `Return only the JSON object (no commentary, no markdown). Use these examples as a guide.\n\n` +
            `Example 1:\n` +
            `Input: \"move north\"\n` +
            `Output: {"intent":{"kind":"move","payload":{"direction":"north"}},"narrative_output":"You move north along the path."}\n\n` +
            `Example 2:\n` +
            `Input: \"say hello to the guard\"\n` +
            `Output: {"intent":{"kind":"dialogue","payload":{"text":"hello to the guard"}},"narrative_output":"You greet the guard and they nod in acknowledgment."}\n\n` +
            `Now produce a JSON response for the provided input.`;

        const user = `Player input: ${text}\nCharacter context: ${JSON.stringify(character_context || {})}\nWorld context: ${JSON.stringify(world_context || {})}`;

        const resp = await client.responses.create({
            model: process.env.OPENAI_MODEL || 'gpt-4o‑mini',
            input: [
                { role: 'system', content: system },
                { role: 'user', content: user }
            ]
        });

        // Responses API may return structured output in different fields; try to extract text
        const out = (resp.output ?? []).map((o: any) => o.content).flat();
        let textOutput = '';
        if (Array.isArray(out)) {
            for (const o of out) {
                if (typeof o === 'string') textOutput += o;
                else if (o?.type === 'output_text' && typeof o.text === 'string') textOutput += o.text;
                else if (o?.type === 'json' && o.json) textOutput += typeof o.json === 'string' ? o.json : JSON.stringify(o.json);
            }
        } else if (typeof resp.output_text === 'string') {
            textOutput = resp.output_text;
        }

        // Try parsing as JSON
        let parsedJson: any = null;
        try {
            parsedJson = JSON.parse(textOutput.trim());
        } catch (e) {
            // If the model wrapped the JSON in triple backticks, strip them
            const stripped = textOutput.replace(/^[`\s]+|[`\s]+$/g, '');
            try { parsedJson = JSON.parse(stripped); } catch (_e) { parsedJson = null; }
        }

        if (parsedJson && parsedJson.intent) {
            intentGuess = IntentSchema.parse(parsedJson.intent);
        }
        if (parsedJson && parsedJson.narrative_output) {
            narrative_output = String(parsedJson.narrative_output);
        }
    } catch (e) {
        req.log.warn('OpenAI call failed: ' + String(e));
    }

    // Fallbacks if OpenAI didn't produce valid output
    if (!intentGuess) {
        intentGuess = IntentSchema.parse({ kind: guessIntent(text), payload: { text } });
    }
    if (!narrative_output) {
        narrative_output = generateNarrative(text, intentGuess.kind);
    }

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

// Profession generation endpoint
const ProfessionInput = z.object({
    race: z.string().optional(),
    archetype: z.string().optional(),
    prompt: z.string().optional()
});

app.post('/profession/generate', async (req, reply) => {
    const parsed = ProfessionInput.safeParse(req.body as unknown);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.message });

    const { race, archetype, prompt } = parsed.data;
    let prof: any = null;
    try {
        const openaiKey = process.env.OPENAI_API_KEY;
        if (!openaiKey) throw new Error('OPENAI_API_KEY not configured');
        const client = new OpenAI({ apiKey: openaiKey });

        const system = `You are a fantasy game design assistant. Produce ONLY valid JSON that matches this schema:\n` +
            `{\n` +
            `  "name": "string",\n` +
            `  "lore": "short flavorful paragraph",\n` +
            `  "mechanics": { /* key-value object with simple mechanical properties like abilities or stats */ }\n` +
            `}\n\n` +
            `Return only the JSON object. Use these examples as a guide.\n\n` +
            `Example 1:\n` +
            `Input: Race=Elf, Archetype=Archer\n` +
            `Output: {"name":"Grove Sentinel","lore":"Elven archers who guard the ancient groves...","mechanics":{"range":6,"precision":8}}\n\n` +
            `Example 2:\n` +
            `Input: Race=Human, Archetype=Mage\n` +
            `Output: {"name":"Arcane Scholar","lore":"A scholar of lost rites...","mechanics":{"mana":30,"spell_power":5}}\n\n` +
            `Now generate a profession for the provided input.`;
        const user = `Race: ${race || 'any'}\nArchetype: ${archetype || 'any'}\nPrompt: ${prompt || ''}`;

        const resp = await client.responses.create({
            model: process.env.OPENAI_MODEL || 'gpt-5.1',
            input: [
                { role: 'system', content: system },
                { role: 'user', content: user }
            ]
        });

        const out = (resp.output ?? []).map((o: any) => o.content).flat();
        let textOutput = '';
        if (Array.isArray(out)) {
            for (const o of out) {
                if (typeof o === 'string') textOutput += o;
                else if (o?.type === 'output_text' && typeof o.text === 'string') textOutput += o.text;
                else if (o?.type === 'json' && o.json) textOutput += typeof o.json === 'string' ? o.json : JSON.stringify(o.json);
            }
        } else if (typeof resp.output_text === 'string') {
            textOutput = resp.output_text;
        }

        let parsedJson: any = null;
        try { parsedJson = JSON.parse(textOutput.trim()); } catch (e) {
            const stripped = textOutput.replace(/^[`\s]+|[`\s]+$/g, '');
            try { parsedJson = JSON.parse(stripped); } catch (_e) { parsedJson = null; }
        }

        if (parsedJson) {
            prof = ProfessionSchema.parse(parsedJson);
        }
    } catch (e) {
        req.log.warn('Profession generation failed: ' + String(e));
    }

    if (!prof) {
        // Fallback simple profession
        prof = ProfessionSchema.parse({
            name: 'Wanderer',
            lore: "A traveler's trade, adaptable and resourceful.",
            mechanics: { stamina: 10, skill: 'forage' }
        });
    }

    return reply.send({ profession: prof });
});

// Character persistence endpoint: forwards a create_character intent to SpacetimeDB
const CharacterCreateSchema = z.object({
    id: z.string().optional(),
    name: z.string(),
    class: z.string().optional(),
    stats: z.record(z.any()).optional()
});

app.post('/characters', async (req, reply) => {
    const parsed = CharacterCreateSchema.safeParse(req.body as unknown);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.message });

    const payload = parsed.data;
    const intent = { kind: 'create_character', payload };

    const stdbUrl = process.env.STDB_URL || 'http://localhost:3000';
    try {
        const res = await fetch(`${stdbUrl}/apply_intent`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...(req.headers.authorization ? { Authorization: req.headers.authorization as string } : {}) },
            body: JSON.stringify(intent)
        });
        if (!res.ok) return reply.code(502).send({ error: `Failed to persist character (${res.status})` });
    } catch (e) {
        req.log.error(e);
        return reply.code(500).send({ error: 'Failed to contact SpacetimeDB' });
    }

    return reply.send({ status: 'ok', character: payload });
});

// Character wizard iterative step endpoint
const WizardStepSchema = z.object({
    session_id: z.string().optional(),
    step: z.number().min(1).max(6).optional(),
    input: z.string().optional(),
    context: z.record(z.any()).optional()
});

const wizardPromptIntro = `You are the character creation engine for Unwritten Realms, a persistent, text-based MMORPG shaped by the actions of its players. The world is emergent, reactive, and bound by player agency. This game is inspired by Kyle Kirrin's Ripple System Novels. Guide the player through character creation step-by-step. Follow the exact step sequence and DO NOT advance until the player provides input. Return a JSON object with keys { step: <number>, prompt: <string>, options?: <array>, data?: <object> }.`;

app.post('/character-wizard/step', async (req, reply) => {
    const parsed = WizardStepSchema.safeParse(req.body as unknown);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.message });

    const { session_id, step, input } = parsed.data;
    try {
        const openaiKey = process.env.OPENAI_API_KEY;
        if (!openaiKey) throw new Error('OPENAI_API_KEY not configured');
        const client = new OpenAI({ apiKey: openaiKey });

        const system = wizardPromptIntro + `\n\nSTEPS:\n1: Ask race (suggest examples, allow custom).\n2: Ask archetype (Fighter or Mystic).\n3: Reveal profession based on race+archetype (provide name, lore, mechanics, 1-3 abilities, starter weapon).\n4: Ask starting region.\n5: Ask brief visual description.\n6: Ask for character name.\nAfter step 6, return a final data object with the full character profile and a narrative wrap-up.`;

        // Build a human-friendly summary of previous choices so the model doesn't re-ask
        const rawContext = parsed.data.context || {};
        const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
        let contextSummary = 'None';
        if (rawContext && typeof rawContext === 'object' && Object.keys(rawContext).length) {
            contextSummary = Object.entries(rawContext).map(([k, v]) => {
                let val = v;
                if (typeof v === 'object') val = JSON.stringify(v);
                return `${capitalize(k)}: ${val}`;
            }).join('\n');
        }

        const userMsg = `Current step: ${step || 1}. Player input: ${input || ''}\nRespond with JSON: { step: <number>, prompt: <string>, options?: [..], data?: {...} }`;

        const contextSystem = `Session context (do not re-ask):\n${contextSummary}\n\nRULES: If a field (Race, Archetype, Profession, Name, etc.) is present in the session context above, DO NOT ask the player to repeat it. Use the provided values as authoritative and proceed to the next logical step. If the current step's output should reveal derived values (e.g., profession from race+archetype), compute them now based on the context.`;

        const resp = await client.responses.create({
            model: process.env.OPENAI_MODEL || 'gpt-5.1',
            input: [
                { role: 'system', content: system },
                { role: 'system', content: contextSystem },
                { role: 'user', content: userMsg }
            ]
        });

        const out = (resp.output ?? []).map((o: any) => o.content).flat();
        let textOutput = '';
        if (Array.isArray(out)) {
            for (const o of out) {
                if (typeof o === 'string') textOutput += o;
                else if (o?.type === 'output_text' && typeof o.text === 'string') textOutput += o.text;
                else if (o?.type === 'json' && o.json) textOutput += typeof o.json === 'string' ? o.json : JSON.stringify(o.json);
            }
        } else if (typeof resp.output_text === 'string') {
            textOutput = resp.output_text;
        }

        // Attempt to parse JSON
        let parsedJson: any = null;
        try { parsedJson = JSON.parse(textOutput.trim()); } catch (e) {
            const stripped = textOutput.replace(/^[`\s]+|[`\s]+$/g, '');
            try { parsedJson = JSON.parse(stripped); } catch (_e) { parsedJson = null; }
        }

        if (parsedJson) {
            try {
                const normalize = (pj: any) => {
                    const result: any = {};
                    result.step = pj.step ?? (step || 1);
                    result.prompt = typeof pj.prompt === 'string' ? pj.prompt : (typeof pj === 'string' ? pj : '');
                    // If the model appended the `data` object as JSON inside the prompt string, remove that chunk
                    if (pj.data && result.prompt) {
                        try {
                            const dataStr = JSON.stringify(pj.data);
                            if (dataStr && result.prompt.includes(dataStr)) {
                                result.prompt = result.prompt.replace(dataStr, '').trim();
                            }
                        } catch (e) {
                            // ignore
                        }
                    }
                    // Normalize options to array
                    if (Array.isArray(pj.options)) result.options = pj.options;
                    else if (pj.options) result.options = [pj.options];
                    else result.options = [];
                    result.data = pj.data ?? null;
                    return result;
                };
                const cleaned = normalize(parsedJson);
                return reply.send({ ok: true, result: cleaned, raw: textOutput });
            } catch (e) {
                // Fallthrough to return raw parsedJson
                return reply.send({ ok: true, result: parsedJson, raw: textOutput });
            }
        }

        return reply.send({ ok: true, result: { step: step || 1, prompt: textOutput }, raw: textOutput });
    } catch (e: any) {
        req.log.error(e);
        return reply.code(500).send({ error: String(e) });
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
