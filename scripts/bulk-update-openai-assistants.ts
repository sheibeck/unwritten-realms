import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

interface AssistantUpdateItem {
    id: string;
    name?: string;
    instructionsFile?: string;
    model?: string;
    metadata?: Record<string, string>;
    skip?: boolean;
}

interface ConfigShape {
    updates: AssistantUpdateItem[];
    defaultModel?: string;
    continueOnError?: boolean;
}

function loadConfig(file: string): ConfigShape {
    const abs = path.resolve(file);
    if (!fs.existsSync(abs)) {
        console.error('Config file not found:', abs);
        process.exit(1);
    }
    return JSON.parse(fs.readFileSync(abs, 'utf-8')) as ConfigShape;
}

async function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

async function updateAssistant(client: OpenAI, item: AssistantUpdateItem, defaults: ConfigShape, dryRun: boolean) {
    if (item.skip) {
        console.log(`⏭️  Skipping assistant ${item.id} (skip flag).`);
        return;
    }
    const payload: any = {};
    if (item.name) payload.name = item.name;
    if (item.model || defaults.defaultModel) payload.model = item.model || defaults.defaultModel;
    if (item.instructionsFile) {
        const absInstr = path.resolve(item.instructionsFile);
        if (!fs.existsSync(absInstr)) {
            throw new Error(`Instructions file missing: ${absInstr}`);
        }
        payload.instructions = fs.readFileSync(absInstr, 'utf-8');
    }
    if (item.metadata) payload.metadata = item.metadata;

    if (Object.keys(payload).length === 0) {
        console.log(`⚠️  No update fields for assistant ${item.id}; skipping.`);
        return;
    }

    if (dryRun) {
        console.log(`[DRY-RUN] Would update ${item.id} with`, payload);
        return;
    }

    // Simple exponential backoff for transient / rate-limit errors
    const maxRetries = 5;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            const updated = await client.beta.assistants.update(item.id, payload);
            console.log(`✅ Updated ${item.id}`, {
                name: updated.name,
                model: updated.model,
                metadata: updated.metadata,
                hasInstructions: !!updated.instructions,
            });
            return;
        } catch (err: any) {
            const status = err?.status || err?.response?.status;
            const isRateLimit = status === 429;
            if (attempt < maxRetries && (isRateLimit || status >= 500)) {
                const delay = 500 * Math.pow(2, attempt);
                console.warn(`Retry ${attempt + 1}/${maxRetries} after ${delay}ms (status=${status}).`);
                await sleep(delay);
                continue;
            }
            throw err;
        }
    }
}

async function main() {
    const configPath = process.argv[2] || 'assistants.config.json';
    const dryRun = process.argv.includes('--dry-run');
    const config = loadConfig(configPath);
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    let failures = 0;
    for (const item of config.updates) {
        try {
            await updateAssistant(client, item, config, dryRun);
        } catch (err: any) {
            failures++;
            console.error(`❌ Failed updating ${item.id}:`, err.message);
            if (!config.continueOnError) {
                console.error('Stopping due to error (set continueOnError=true to proceed).');
                process.exit(1);
            }
        }
    }

    if (failures) {
        console.log(`Finished with ${failures} failure(s).`);
    } else {
        console.log('All assistant updates applied successfully.');
    }
}

main();
