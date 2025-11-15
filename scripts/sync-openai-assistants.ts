import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import dotenv from 'dotenv';

dotenv.config();

interface UpdateEntry {
    id: string;                 // OpenAI assistant id
    name?: string;              // Optional override for assistant name
    instructionsFile: string;   // Path to prompt file
    model?: string;             // Model override or front matter value
    metadata?: Record<string, string>; // Optional metadata from config
    frontMatter?: Record<string, string>; // Raw parsed front matter
}
interface ConfigShape {
    defaultModel?: string;
    continueOnError?: boolean;
    updates: UpdateEntry[];
}
interface StateShape { [id: string]: { hash: string; updatedAt: string; }; }

// If a path arg is provided and not a flag treat it as config path, else default.
const CONFIG_PATH = process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : 'assistants.config.json';
const DRY_RUN = process.argv.includes('--dry-run');
const FORCE = process.argv.includes('--force');
const ONLY_ARG_INDEX = process.argv.findIndex(a => a === '--only');
const ONLY = ONLY_ARG_INDEX >= 0 ? process.argv[ONLY_ARG_INDEX + 1] : undefined;
const SCAN_ONLY = process.argv.includes('--scan'); // Ignore config, just scan /ai
const AI_ROOT = 'ai';
// Deprecated external state file replaced by embedded front matter metadata.
// Legacy constant left commented for reference.
// const STATE_PATH = '.assistants-state.json';

function loadJSON<T>(p: string, fallback: T): T { try { return JSON.parse(fs.readFileSync(p, 'utf-8')); } catch { return fallback; } }
// saveJSON retained only for potential future config persistence (not used for hashes now)
function saveJSON(p: string, data: any) { fs.writeFileSync(p, JSON.stringify(data, null, 2)); }
function sha256(content: string) { return crypto.createHash('sha256').update(content).digest('hex'); }

function parseFrontMatter(raw: string): { meta: Record<string, string>; body: string } {
    if (!raw.startsWith('---')) return { meta: {}, body: raw };
    const parts = raw.split('\n');
    // Find second delimiter
    let endIndex = -1;
    for (let i = 1; i < parts.length; i++) {
        if (parts[i].trim() === '---') { endIndex = i; break; }
    }
    if (endIndex === -1) return { meta: {}, body: raw }; // malformed
    const metaLines = parts.slice(1, endIndex);
    const meta: Record<string, string> = {};
    for (const line of metaLines) {
        const idx = line.indexOf(':');
        if (idx === -1) continue;
        const key = line.slice(0, idx).trim();
        const value = line.slice(idx + 1).trim();
        if (key) meta[key] = value;
    }
    const body = parts.slice(endIndex + 1).join('\n').trim();
    return { meta, body };
}

function scanPromptFiles(root: string): UpdateEntry[] {
    const absRoot = path.resolve(root);
    if (!fs.existsSync(absRoot)) return [];
    const entries: UpdateEntry[] = [];
    function walk(dir: string) {
        for (const item of fs.readdirSync(dir)) {
            const full = path.join(dir, item);
            const stat = fs.statSync(full);
            if (stat.isDirectory()) { walk(full); continue; }
            if (!item.endsWith('.txt')) continue; // only consider .txt prompt files
            const raw = fs.readFileSync(full, 'utf-8');
            const { meta } = parseFrontMatter(raw);
            const assistantId = meta.assistant_id || meta.assistantId;
            if (!assistantId) continue; // skip files without id
            entries.push({
                id: assistantId,
                name: meta.name,
                model: meta.model,
                instructionsFile: full,
                frontMatter: meta
            });
        }
    }
    walk(absRoot);
    return entries;
}

function resolveInstructions(entry: UpdateEntry): { content: string; abs: string; hash: string; meta: Record<string, string>; raw: string } {
    const abs = path.resolve(entry.instructionsFile);
    if (!fs.existsSync(abs)) throw new Error(`Instructions file missing: ${abs}`);
    const raw = fs.readFileSync(abs, 'utf-8');
    const { body, meta } = parseFrontMatter(raw);
    const content = body || raw; // fallback to whole file if parsing failed
    return { content, abs, hash: sha256(content), meta, raw };
}

function writeFrontMatter(abs: string, meta: Record<string, string>, body: string) {
    // Ensure required fields remain at top in a stable order
    const order = [
        'assistant_id', 'name', 'model', 'project', 'checksum', 'content_hash', 'updated_at'
    ];
    // Recompute checksum based on body for transparency (sha256:<hash>)
    if (meta.content_hash) meta.checksum = `sha256:${meta.content_hash}`;
    const lines: string[] = ['---'];
    for (const key of order) {
        if (meta[key]) lines.push(`${key}: ${meta[key]}`);
    }
    // Include any additional keys not in order
    for (const k of Object.keys(meta)) {
        if (!order.includes(k)) lines.push(`${k}: ${meta[k]}`);
    }
    lines.push('---', '');
    const out = lines.join('\n') + body.trim() + (body.endsWith('\n') ? '' : '\n');
    fs.writeFileSync(abs, out, 'utf-8');
}

async function main() {
    if (!process.env.OPENAI_API_KEY) {
        console.error('OPENAI_API_KEY not set in environment');
        process.exit(1);
    }
    const config: ConfigShape = loadJSON(CONFIG_PATH, { updates: [] });

    // Gather update entries either from scanning or config (or both)
    let scanned = scanPromptFiles(AI_ROOT);
    if (SCAN_ONLY) {
        console.log(`Scanning prompt files under '${AI_ROOT}' (found ${scanned.length}).`);
    } else {
        // Merge config updates (override scanned by id) if any
        if (config.updates.length) {
            const byId: Record<string, UpdateEntry> = {};
            for (const s of scanned) byId[s.id] = s;
            for (const c of config.updates) {
                if (!c.id) continue;
                if (byId[c.id]) {
                    byId[c.id] = { ...byId[c.id], ...c }; // config overrides scanned fields
                } else {
                    byId[c.id] = c; // include extra not present in scanned set
                }
            }
            scanned = Object.values(byId);
        }
    }

    if (!scanned.length) {
        console.error('No prompt files with front matter assistant_id found. Provide prompts in /ai or use config.');
        process.exit(1);
    }
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    let failures = 0;
    for (const entry of scanned) {
        if (!entry.id || entry.id.includes('PLACEHOLDER')) {
            console.warn(`Skipping entry with placeholder id: ${entry.id}`);
            continue;
        }
        if (ONLY && entry.id !== ONLY) continue;
        try {
            const { content, abs, hash, meta } = resolveInstructions(entry);
            const existingHash = meta.content_hash || (meta.checksum?.startsWith('sha256:') ? meta.checksum.split(':')[1] : undefined);
            const changed = FORCE || !existingHash || existingHash !== hash;
            if (!changed) {
                console.log(`⏭️  Unchanged: ${entry.id} (${path.basename(abs)})`);
                continue;
            }
            const payload: any = { instructions: content };
            if (entry.name) payload.name = entry.name;
            if (entry.model || config.defaultModel) payload.model = entry.model || config.defaultModel;
            if (entry.metadata) payload.metadata = entry.metadata;
            if (DRY_RUN) {
                console.log(`[DRY-RUN] Would update ${entry.id} with fields:`, Object.keys(payload));
                // Show prospective front matter update summary
                console.log(`[DRY-RUN] New hash for ${entry.id}: ${hash}`);
                continue;
            }
            const updated = await client.beta.assistants.update(entry.id, payload);
            const updatedAt = new Date().toISOString();
            meta.content_hash = hash;
            meta.updated_at = updatedAt;
            // Preserve assistant_id, name, model, project if missing
            if (!meta.assistant_id) meta.assistant_id = entry.id;
            if (updated.name && !meta.name) meta.name = updated.name;
            if (updated.model && !meta.model) meta.model = updated.model as string;
            writeFrontMatter(abs, meta, content);
            console.log(`✅ Updated ${entry.id}:`, {
                name: updated.name,
                model: updated.model,
                instructionsBytes: Buffer.byteLength(content, 'utf-8'),
                metadata: updated.metadata,
                contentHash: hash,
                updatedAt
            });
        } catch (err: any) {
            failures++;
            console.error(`❌ Failed updating ${entry.id}:`, err.message);
            if (!config.continueOnError) break;
        }
    }

    if (failures) {
        console.log(`Finished with ${failures} failure(s).`);
        process.exit(1);
    } else {
        console.log('All assistant sync operations completed.');
    }
}

main();
