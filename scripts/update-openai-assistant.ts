import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

function parseArgs(argv: string[]) {
  const args: Record<string, string | boolean> = {};
  let i = 0;
  while (i < argv.length) {
    const token = argv[i];
    if (token.startsWith('--')) {
      const key = token.replace(/^--/, '');
      const next = argv[i + 1];
      if (!next || next.startsWith('--')) {
        args[key] = true; // boolean flag
        i += 1;
      } else {
        args[key] = next;
        i += 2;
      }
    } else {
      // positional collected as _posN
      const posKey = `_pos${Object.keys(args).filter(k => k.startsWith('_pos')).length}`;
      args[posKey] = token;
      i += 1;
    }
  }
  return args;
}

function parseMetadata(metaArg?: string): Record<string, string> | undefined {
  if (!metaArg) return undefined;
  const out: Record<string, string> = {};
  metaArg.split(',').forEach(pair => {
    const [k, v] = pair.split('=');
    if (k && v) out[k.trim()] = v.trim();
  });
  return Object.keys(out).length ? out : undefined;
}

async function main() {
  const argv = process.argv.slice(2);
  const args = parseArgs(argv);
  const assistantId = (args._pos0 as string) || (args.id as string);
  if (!assistantId) {
    console.error('Usage: tsx scripts/update-openai-assistant.ts <assistant_id> [--name "New Name"] [--instructions path.txt] [--model gpt-4.1-mini] [--metadata key=val,key2=val] [--dry-run]');
    process.exit(1);
  }

  const name = (args.name as string) || undefined;
  const instructionsPath = (args.instructions as string) || undefined;
  let instructions: string | undefined;
  if (instructionsPath) {
    const abs = path.resolve(instructionsPath);
    if (!fs.existsSync(abs)) {
      console.error(`Instructions file not found: ${abs}`);
      process.exit(1);
    }
    instructions = fs.readFileSync(abs, 'utf-8');
  }
  const model = (args.model as string) || undefined;
  const metadata = parseMetadata(args.metadata as string | undefined);
  const dryRun = !!args['dry-run'];

  if (!name && !instructions && !model && !metadata) {
    console.error('At least one field to update must be provided (name/instructions/model/metadata).');
    process.exit(1);
  }

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const payload: any = {};
  if (name) payload.name = name;
  if (instructions) payload.instructions = instructions;
  if (model) payload.model = model;
  if (metadata) payload.metadata = metadata;

  if (dryRun) {
    console.log('[DRY-RUN] Would update assistant', assistantId, 'with:', payload);
    process.exit(0);
  }

  try {
    const updated = await client.beta.assistants.update(assistantId, payload);
    console.log('Updated assistant:', updated.id, '->', {
      name: updated.name,
      model: updated.model,
      hasInstructions: !!updated.instructions,
      metadata: updated.metadata,
    });
  } catch (err: any) {
    console.error('Failed to update assistant:', err.message);
    process.exit(1);
  }
}

main();
