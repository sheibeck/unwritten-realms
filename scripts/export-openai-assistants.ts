import 'dotenv/config';
import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const PROJECT_TAG = 'Unwritten-Realms';
const apiKey = process.env.OPENAI_API_KEY || process.env.openai_api_key;
if (!apiKey) {
  console.error('OpenAI API key missing. Set OPENAI_API_KEY in .env.');
  process.exit(1);
}

const aiRoot = path.resolve('ai');
if (!fs.existsSync(aiRoot)) fs.mkdirSync(aiRoot, { recursive: true });

const clearFlag = process.argv.includes('--clear');

function slug(name: string): string {
  return name.toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 80);
}

function gatherPromptFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true })
    .flatMap(e => {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) return gatherPromptFiles(full);
      return e.isFile() && e.name.endsWith('_prompt.txt') ? [full] : [];
    });
}

function computeChecksum(content: string) {
  return 'sha256:' + crypto.createHash('sha256').update(content, 'utf8').digest('hex');
}

async function run() {
  const client = new OpenAI({ apiKey });
  const list = await client.beta.assistants.list({ limit: 100 });
  const filtered = list.data.filter(a => a.metadata && a.metadata.project === PROJECT_TAG);
  if (clearFlag) {
    for (const f of gatherPromptFiles(aiRoot)) {
      fs.unlinkSync(f);
    }
    console.log('Cleared existing prompt files.');
  }
  const report: string[] = [];
  const now = new Date().toISOString();
  function resolveSubfolder(name: string): string {
    const normalized = name.toLowerCase().trim();
    const base = normalized.split(/[ _]/)[0];
    return base || 'misc';
  }

  for (const a of filtered) {
    const safeName = a.name || a.id;
    const folder = path.join(aiRoot, resolveSubfolder(safeName));
    if (!fs.existsSync(folder)) fs.mkdirSync(folder, { recursive: true });
    const filename = path.join(folder, `${slug(safeName)}_prompt.txt`);
    const body = (a.instructions || '').replace(/\r\n/g, '\n').trim();
    const checksum = computeChecksum(body);
    const remoteUpdated = (a as any).updated_at ? new Date((a as any).updated_at * 1000).toISOString() : now;
    const remoteCreated = (a as any).created_at ? new Date((a as any).created_at * 1000).toISOString() : now;
    const yaml = [
      '---',
      `assistant_id: ${a.id}`,
      `name: ${a.name || ''}`,
      `model: ${a.model || ''}`,
      `project: ${PROJECT_TAG}`,
      `remote_created_at: ${remoteCreated}`,
      `remote_updated_at: ${remoteUpdated}`,
      `exported_at: ${now}`,
      `checksum: ${checksum}`,
      '---',
      ''
    ].join('\n');
    fs.writeFileSync(filename, yaml + body + '\n', 'utf8');
    report.push(`${a.id}\t${path.relative(process.cwd(), filename)}`);
  }
  console.log('Exported assistants:');
  report.forEach(r => console.log(r));
  console.log(`Total exported: ${report.length}`);
}

run().catch(err => {
  console.error('Export failed:', err);
  process.exit(1);
});
