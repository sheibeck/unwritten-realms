import Fastify from 'fastify';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import cors from '@fastify/cors';
import fetch from 'cross-fetch';
import crypto from 'crypto';
import OpenAI from 'openai';
import { z } from 'zod';
import { IntentSchema } from '../../shared/intent-schema.js';
import { CharacterContextSchema, WorldContextSchema } from '../../shared/types.js';
import { ProfessionSchema } from '../../shared/profession.js';
import { CharacterProfilePartialSchema } from '../../shared/character-profile.js';
import { firstStepId, nextStepId, stepNumber, wizardSteps } from '../../shared/wizard-steps.js';

// Strict shape for interpret responses
const InterpretResponseSchema = z.object({
    intent: IntentSchema,
    narrative_output: z.string().min(1)
}).strict();
import { loginWithGoogle } from './auth/auth-controller.js';

const openai_model = process.env.OPENAI_MODEL || 'gpt-4o-mini';

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

// Normalize Zod-generated JSON Schema to meet Responses API requirements.
function normalizeJsonSchema(js: any, opts?: { forceRequired?: boolean }): any {
    const forceRequired = opts?.forceRequired ?? true;
    if (!js || typeof js !== 'object') return js;
    // Handle composite keywords
    ['anyOf', 'oneOf', 'allOf'].forEach(k => {
        if (Array.isArray(js[k])) js[k] = js[k].map((s: any) => normalizeJsonSchema(s, opts));
    });

    // Arrays: normalize items first
    if (js.type === 'array' && js.items) {
        js.items = normalizeJsonSchema(js.items, opts);
    }

    // If this is an object schema with properties
    if ((js.type === 'object' || (Array.isArray(js.type) && js.type.includes('object'))) && js.properties && typeof js.properties === 'object') {
        const keys = Object.keys(js.properties);
        if (forceRequired) {
            js.required = Array.isArray(js.required) ? Array.from(new Set([...js.required, ...keys])) : keys.slice();
        }
        js.additionalProperties = js.additionalProperties === undefined ? false : js.additionalProperties;
        for (const k of keys) {
            js.properties[k] = normalizeJsonSchema(js.properties[k], opts);
        }
        return js;
    }

    return js;
}

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

        // Use structured outputs: provide a minimal prompt and pass the JSON Schema via `text_format`.
        const system = `You are a concise game assistant. Produce the structured response described by the provided JSON Schema.`;

        const user = `Player input: ${text}\nCharacter context: ${JSON.stringify(character_context || {})}\nWorld context: ${JSON.stringify(world_context || {})}`;

        const interpretJsonSchema = normalizeJsonSchema(z.toJSONSchema(InterpretResponseSchema));

        const resp = await client.responses.create(({
            model: openai_model,
            input: [
                { role: 'system', content: system },
                { role: 'user', content: user }
            ],
            text: {
                format: {
                    type: 'json_schema',
                    name: 'interpret_response',
                    schema: interpretJsonSchema,
                    strict: true
                }
            }
        }) as any);

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

        // Ask the model to return an InterpretResponseSchema so we get an intent + narrative_output
        const system = `You are a concise profession generator for a fantasy game. Return the structured response described by the provided JSON Schema.`;
        const user = `Generate a profession based on Race: ${race || 'any'} and Archetype: ${archetype || 'any'}. Additional prompt: ${prompt || ''}`;

        // Use the InterpretResponseSchema so callers receive intent + narrative_output alongside the profession JSON
        const interpretJsonSchema = normalizeJsonSchema(z.toJSONSchema(InterpretResponseSchema));

        const resp = await client.responses.create(({
            model: openai_model,
            input: [
                { role: 'system', content: system },
                { role: 'user', content: user }
            ],
            text: {
                format: {
                    type: 'json_schema',
                    name: 'profession_response',
                    schema: interpretJsonSchema,
                    strict: true
                }
            }
        }) as any);

        // Extract structured JSON parts and text fallback (reuse interpret extraction logic)
        const out = (resp.output ?? []).map((o: any) => o.content).flat();
        let textOutput = '';
        let parsedJson: any = null;
        for (const part of out) {
            if (typeof part === 'string') textOutput += part;
            else if (part?.type === 'output_text' && typeof part.text === 'string') textOutput += part.text;
            else if (part?.type === 'json' && part.json) {
                if (!parsedJson) parsedJson = typeof part.json === 'string' ? JSON.parse(part.json) : part.json;
                textOutput += typeof part.json === 'string' ? part.json : JSON.stringify(part.json);
            }
        }
        if (!parsedJson && typeof resp.output_text === 'string') {
            try { parsedJson = JSON.parse(resp.output_text.trim()); } catch (e) { parsedJson = null; }
        }
        if (!textOutput && typeof resp.output_text === 'string') textOutput = resp.output_text;

        if (parsedJson) {
            try {
                const interp = InterpretResponseSchema.parse(parsedJson);
                // Attempt to parse a profession object from the narrative_output or payload if included
                try {
                    const maybeProf = JSON.parse(interp.narrative_output);
                    prof = ProfessionSchema.parse(maybeProf);
                } catch (_) {
                    // If narrative_output isn't raw JSON, try to find a JSON blob inside the text
                    const m = interp.narrative_output.match(/\{[\s\S]*\}/);
                    if (m) {
                        try { prof = ProfessionSchema.parse(JSON.parse(m[0])); } catch (_) { /* ignore */ }
                    }
                }
            } catch (zerr) {
                req.log.warn('Interpret parse failed for profession generation: ' + String(zerr));
            }
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
    stats: z.record(z.any(), z.any()).optional()
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

// Character wizard iterative step endpoint (step-at-a-time, name is final, no description step)
type WizardStepId = (typeof wizardSteps)[number];
type WizardSession = {
    currentStepId: WizardStepId;
    context: Record<string, any>;
    staged: Record<string, any>;
    locked: Record<string, boolean>;
    preview?: any;
};

const WizardStepSchema = z.object({
    session_id: z.string().optional(),
    step_id: z.string().optional(),
    intent: z.enum(['assist', 'select', 'lock', 'regenerate', 'start_over']).default('assist'),
    message: z.string().optional(),
    selection: z.string().optional(),
    context: z.record(z.any(), z.any()).optional()
});

const wizardPromptIntro = `You are the character creation engine for Unwritten Realms, a persistent, text-based MMORPG shaped by the actions of its players. The world is emergent, reactive, and bound by player agency. This game is inspired by Kyle Kirrin's Ripple System Novels. Guide the player through character creation step-by-step. DO NOT advance steps on your own. Respect the current step and only provide content for that step. Return JSON: { step: <number>, prompt: <string>, options?: <array>, preview?: <object>, data?: <object> }.`;

function makeSessionId() {
    try {
        return crypto.randomUUID();
    } catch {
        return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
    }
}

const wizardSessions = new Map<string, WizardSession>();

function getSession(sessionId?: string): { id: string; session: WizardSession } {
    const id = sessionId || makeSessionId();
    if (!wizardSessions.has(id)) {
        wizardSessions.set(id, {
            currentStepId: firstStepId,
            context: {},
            staged: {},
            locked: {},
            preview: null
        });
    }
    return { id, session: wizardSessions.get(id)! };
}

function normalizeOption(o: any) {
    if (!o) return null;
    const name = o.name ?? o.label ?? o.title ?? o.value ?? '';
    const description = o.description ?? o.desc ?? '';
    const value = o.value ?? name;
    return { name, description, value };
}

function commitStepValue(stepId: WizardStepId, value: any, session: WizardSession) {
    if (!value) return;
    if (stepId === 'profession_preview') {
        session.context.profession = session.preview || value;
        return;
    }
    if (stepId === 'name') {
        session.context.name = value;
        return;
    }
    // race / archetype
    session.context[stepId] = value;
}

app.post('/character-wizard/step', async (req, reply) => {
    const parsed = WizardStepSchema.safeParse(req.body as unknown);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.message });

    const { id: resolvedSessionId, session } = getSession(parsed.data.session_id);
    const intent = parsed.data.intent || 'assist';
    const message = parsed.data.message || '';
    const selection = parsed.data.selection || '';
    const incomingStepId = (parsed.data.step_id as WizardStepId | undefined) || session.currentStepId;

    // If client asks for start over, reset the session but still proceed to generate fresh options via the model
    if (intent === 'start_over') {
        session.currentStepId = firstStepId;
        session.context = {};
        session.staged = {};
        session.locked = {};
        session.preview = null;
        wizardSessions.set(resolvedSessionId, session);
    }

    let currentStepId: WizardStepId = session.currentStepId;
    if (incomingStepId !== currentStepId) {
        req.log.warn(`Ignoring mismatched step_id=${incomingStepId}, using current=${currentStepId}`);
    }

    // Handle lock before calling the model so we advance to the next step's prompt immediately
    if (intent === 'lock') {
        const value = session.staged[currentStepId] || selection || message;
        commitStepValue(currentStepId, value, session);
        session.locked[currentStepId] = true;
        const next = nextStepId(currentStepId);
        if (next) {
            session.currentStepId = next;
            currentStepId = next;
        }
        // clear staged for the new step
        session.staged[currentStepId] = null;
    } else {
        // Allow selection staging or regenerate
        if (intent === 'select') {
            session.staged[currentStepId] = selection || message;
        }
        if (intent === 'regenerate') {
            session.staged[currentStepId] = null;
            if (currentStepId === 'profession_preview') {
                session.preview = null;
            }
        }
    }

    // Build context summary for model
    const rawContext = { ...(parsed.data.context || {}), ...(session.context || {}) };
    const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
    let contextSummary = 'None';
    if (rawContext && typeof rawContext === 'object' && Object.keys(rawContext).length) {
        contextSummary = Object.entries(rawContext).map(([k, v]) => {
            let val = v;
            if (typeof v === 'object') val = JSON.stringify(v);
            return `${capitalize(k)}: ${val}`;
        }).join('\n');
    }

    // Prepare AI prompt for the current step only
    const stepNum = stepNumber(currentStepId);
    const system = wizardPromptIntro + `\n\nSTEPS (name is last):\n1: Race (provide 3-5 races with name+description)\n2: Archetype (ONLY TWO CHOICES: Warrior and Mystic. Provide exactly these two with name+description.)\n3: Profession preview (generate exactly one profession with FULL DETAILS: name, lore, mechanics, starter weapon, and 1-3 abilities; include exactly one option representing that profession and NO other options)\n4: Name (provide 3-5 suggested CHARACTER NAMES; do not reuse or include the profession name/title)\n5: Summary (recap selections; options must include Confirm Character and Start Over)\n\nRULES: Stay on the current step (${stepNum}). Do NOT move to another step. Always include an options array for the current step with at least one entry (for archetype it must be exactly the two specified; for profession it must be exactly one option). Provide the profession details in the 'preview' object when on the profession step. For the name step, never suggest the profession name or title—only plausible character names. If you cannot comply, return an error message in 'prompt' explaining what is missing.`;
    const userMsg = `Current step: ${stepNum} (${currentStepId}). Intent: ${intent}. Player text: ${message || selection || ''}\nSession context:\n${contextSummary}\nRespond JSON: { step: ${stepNum}, prompt: <string>, options: [...], preview?: <object>, data?: <object> }`;

    let modelResult: any = null;
    let modelDebug: any = {};
    try {
        const openaiKey = process.env.OPENAI_API_KEY;
        if (!openaiKey) throw new Error('OPENAI_API_KEY not configured');
        const client = new OpenAI({ apiKey: openaiKey });

        const WizardOption = z.object({
            name: z.string(),
            description: z.string().optional(),
            value: z.string().optional()
        }).strict();
        const ProfessionPreview = z.object({
            name: z.string(),
            lore: z.string(),
            mechanics: z.record(z.string(), z.any()).optional(),
            abilities: z.array(z.string()).min(1),
            starterWeapon: z.string()
        }).strict();
        const WizardResponse = z.object({
            step: z.number().int(),
            prompt: z.string().min(1),
            options: z.array(WizardOption).min(1).max(8),
            data: z.record(z.any(), z.any()).optional(),
            preview: ProfessionPreview.optional()
        }).strict();

        const wizardSchemaBase = normalizeJsonSchema(z.toJSONSchema(WizardResponse), { forceRequired: false });
        // Responses validator expects every property to be listed in required, even if null is allowed
        if (wizardSchemaBase.properties) {
            wizardSchemaBase.required = Object.keys(wizardSchemaBase.properties);
        }
        // Require option properties to satisfy Responses validator expectations
        if (wizardSchemaBase.properties?.options?.items) {
            const itemProps = wizardSchemaBase.properties.options.items.properties || {};
            wizardSchemaBase.properties.options.items.required = Object.keys(itemProps);
            wizardSchemaBase.properties.options.items.additionalProperties = false;
            wizardSchemaBase.properties.options.items.properties = itemProps;
        }
        // Allow arbitrary data/preview but satisfy validator by setting additionalProperties=false
        if (wizardSchemaBase.properties?.data) {
            wizardSchemaBase.properties.data = { type: ['object', 'null'], additionalProperties: false };
        }
        if (wizardSchemaBase.properties?.preview) {
            wizardSchemaBase.properties.preview.additionalProperties = false;
            // Ensure all preview properties are required
            const pprops = wizardSchemaBase.properties.preview.properties || {};
            wizardSchemaBase.properties.preview.required = Object.keys(pprops);
            if (wizardSchemaBase.properties.preview.properties?.mechanics) {
                wizardSchemaBase.properties.preview.properties.mechanics = {
                    type: ['object', 'null'],
                    additionalProperties: false
                };
            }
        }

        const resp = await client.responses.create(({
            model: openai_model,
            input: [
                { role: 'system', content: system },
                { role: 'user', content: userMsg }
            ],
            text: {
                format: {
                    type: 'json_schema',
                    name: 'wizard_response',
                    schema: wizardSchemaBase,
                    strict: true
                }
            }
        }) as any);

        const out = (resp.output ?? []).map((o: any) => o.content).flat();
        let parsedJson: any = null;
        let textOutput = '';
        for (const part of out) {
            if (typeof part === 'string') textOutput += part;
            else if (part?.type === 'output_text' && typeof part.text === 'string') textOutput += part.text;
            else if (part?.type === 'json' && part.json) {
                if (!parsedJson) parsedJson = typeof part.json === 'string' ? JSON.parse(part.json) : part.json;
                textOutput += typeof part.json === 'string' ? part.json : JSON.stringify(part.json);
            }
        }
        if (!parsedJson && typeof resp.output_text === 'string') {
            try { parsedJson = JSON.parse(resp.output_text.trim()); } catch { parsedJson = null; }
        }
        if (!textOutput && typeof resp.output_text === 'string') textOutput = resp.output_text;

        modelResult = parsedJson || { step: stepNum, prompt: textOutput };
        modelDebug = {
            rawText: textOutput,
            parsedJson,
            responseOutput: resp.output,
            responseOutputText: resp.output_text,
            system,
            userMsg
        };
    } catch (e: any) {
        req.log.warn('Wizard model failed: ' + String(e));
        return reply.send({
            ok: false,
            error: 'model_call_failed',
            result: {
                stepId: currentStepId,
                prompt: 'Model call failed',
                options: [],
                preview: null,
                data: null,
                context: session.context,
                locked: false,
                canAdvance: false,
                sessionId: resolvedSessionId,
                nextStepId: nextStepId(currentStepId)
            },
            debug: {
                error: String(e),
                system,
                userMsg
            }
        });
    }

    const normalizedOptions = Array.isArray(modelResult.options) ? modelResult.options.map(normalizeOption).filter(Boolean) : [];
    const cleaned: any = {};
    cleaned.prompt = typeof modelResult.prompt === 'string' ? modelResult.prompt : '';
    cleaned.preview = modelResult.preview || (modelResult.data?.profession ?? null);
    cleaned.data = modelResult.data || null;
    cleaned.options = normalizedOptions;

    if (currentStepId === 'profession_preview') {
        session.preview = cleaned.preview || session.preview || cleaned.data;
    } else {
        // Do not leak profession preview into other steps
        cleaned.preview = null;
    }

    cleaned.stepId = currentStepId;
    cleaned.context = session.context;
    cleaned.locked = Boolean(session.locked[currentStepId]);
    cleaned.canAdvance = cleaned.locked;
    cleaned.sessionId = resolvedSessionId;
    cleaned.nextStepId = nextStepId(currentStepId);
    cleaned.debug = { ...modelDebug, stepId: currentStepId };

    // If the model failed to provide options, surface an error instead of falling back
    if (!Array.isArray(cleaned.options) || cleaned.options.length === 0) {
        return reply.send({
            ok: false,
            error: 'model_missing_options',
            result: cleaned
        });
    }

    return reply.send({ ok: true, result: cleaned });
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
