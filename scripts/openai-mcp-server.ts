import 'dotenv/config';
import { Server } from "@modelcontextprotocol/sdk/server";
import OpenAI from "openai";
import fs from "fs";
import path from "path";
import crypto from "crypto";

// Load API key (supports both OPENAI_API_KEY and lowercase openai_api_key)
const resolvedApiKey = process.env.OPENAI_API_KEY || process.env.openai_api_key;
if (!resolvedApiKey) {
  console.error("OpenAI API key not found in environment (.env). Set OPENAI_API_KEY before running.");
}

const openai = new OpenAI({ apiKey: resolvedApiKey });
const aiRoot = path.resolve("ai");
const PROJECT_TAG = "Unwritten-Realms";

// Utility: read .txt prompt files recursively under /ai
function gatherPromptFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const results: string[] = [];
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) results.push(...gatherPromptFiles(full));
    else if (e.isFile() && e.name.endsWith("_prompt.txt")) results.push(full);
  }
  return results;
}

function parseFrontMatterAndBody(raw: string) {
  // YAML front matter between --- lines
  if (raw.startsWith('---')) {
    const end = raw.indexOf('\n---', 3);
    if (end !== -1) {
      const fmText = raw.slice(3, end).trim();
      const body = raw.slice(end + 4).replace(/^\s+/, '');
      const meta: Record<string,string> = {};
      for (const line of fmText.split(/\r?\n/)) {
        const m = line.match(/^(\w[\w_-]*):\s*(.*)$/);
        if (m) meta[m[1]] = m[2];
      }
      return { meta, body };
    }
  }
  return { meta: {}, body: raw };
}

function computeChecksum(content: string) {
  return 'sha256:' + crypto.createHash('sha256').update(content, 'utf8').digest('hex');
}

async function syncFolder(): Promise<string> {
  const files = gatherPromptFiles(aiRoot);
  const existing = await openai.beta.assistants.list({ limit: 100 });
  const mapByName = new Map(existing.data.map(a => [a.name, a]));
  const report: string[] = [];

  for (const file of files) {
    const raw = fs.readFileSync(file, "utf8");
    const { meta, body } = parseFrontMatterAndBody(raw);
    const content = body.trim();
    const baseName = path.basename(file).replace(/_prompt\.txt$/, "");
    const existingAssistant = mapByName.get(baseName);
    if (!existingAssistant) {
      const created = await openai.beta.assistants.create({
        name: baseName,
        instructions: content,
        model: "gpt-4.1-mini",
        metadata: { project: PROJECT_TAG }
      });
      report.push(`Created assistant ${created.id} <- ${baseName}`);
    } else {
      // Repair metadata if missing or wrong, and update instructions
      const needsMetaFix = !existingAssistant.metadata || existingAssistant.metadata.project !== PROJECT_TAG;
      await openai.beta.assistants.update(existingAssistant.id, {
        instructions: content,
        metadata: needsMetaFix ? { ...(existingAssistant.metadata||{}), project: PROJECT_TAG } : existingAssistant.metadata
      });
      report.push(`Updated assistant ${existingAssistant.id} <- ${baseName}${needsMetaFix ? ' (metadata fixed)' : ''}`);
    }
  }
  return report.join("\n");
}

// Generic tool wrapper helper
const tool = (name: string, description: string, inputSchema: any, handler: any) => {
  (server as any).tool(name, { description, inputSchema }, handler);
};

const server = new Server({
  name: "openai-assistants",
  version: "0.1.0",
  capabilities: { tools: {} }
});

// Tools

tool("listAssistants", "List project-scoped OpenAI assistants (id + name)", { type: "object", properties: {}, additionalProperties: false }, async () => {
  const list = await openai.beta.assistants.list({ limit: 100 });
  const filtered = list.data.filter(a => a.metadata && a.metadata.project === PROJECT_TAG);
  return { content: [{ type: "text", text: JSON.stringify(filtered.map(a => ({ id: a.id, name: a.name })), null, 2) }] };
});

tool("createAssistant", "Create a new project-scoped assistant", {
  type: "object",
  properties: {
    name: { type: "string" },
    instructions: { type: "string" },
    model: { type: "string" }
  },
  required: ["name", "instructions"],
  additionalProperties: false
}, async (args: any) => {
  const assistant = await openai.beta.assistants.create({
    name: args.name,
    instructions: args.instructions,
    model: args.model || "gpt-4.1-mini",
    metadata: { project: PROJECT_TAG }
  });
  return { content: [{ type: "text", text: `Created ${assistant.id}` }] };
});

tool("updateAssistant", "Update project-scoped assistant instructions", {
  type: "object",
  properties: {
    id: { type: "string" },
    instructions: { type: "string" }
  },
  required: ["id", "instructions"],
  additionalProperties: false
}, async (args: any) => {
  const existing = await openai.beta.assistants.retrieve(args.id);
  if (!existing.metadata || existing.metadata.project !== PROJECT_TAG) {
    return { content: [{ type: "text", text: `Refused: assistant ${args.id} not tagged for project ${PROJECT_TAG}` }] };
  }
  const updated = await openai.beta.assistants.update(args.id, { instructions: args.instructions });
  return { content: [{ type: "text", text: `Updated ${updated.id}` }] };
});

tool("deleteAssistant", "Delete project-scoped assistant by id", {
  type: "object",
  properties: { id: { type: "string" } },
  required: ["id"],
  additionalProperties: false
}, async (args: any) => {
  const existing = await openai.beta.assistants.retrieve(args.id);
  if (!existing.metadata || existing.metadata.project !== PROJECT_TAG) {
    return { content: [{ type: "text", text: `Refused: assistant ${args.id} not tagged for project ${PROJECT_TAG}` }] };
  }
  await openai.beta.assistants.del(args.id);
  return { content: [{ type: "text", text: `Deleted ${args.id}` }] };
});

tool("retagAssistant", "Apply project tag metadata to an existing assistant", {
  type: "object",
  properties: { id: { type: "string" } },
  required: ["id"],
  additionalProperties: false
}, async (args: any) => {
  const existing = await openai.beta.assistants.retrieve(args.id);
  const updated = await openai.beta.assistants.update(args.id, {
    metadata: { ...(existing.metadata||{}), project: PROJECT_TAG }
  });
  return { content: [{ type: "text", text: `Retagged ${updated.id}` }] };
});

tool("syncFolder", "Sync all *_prompt.txt files under /ai to assistants", { type: "object", properties: {}, additionalProperties: false }, async () => {
  const result = await syncFolder();
  return { content: [{ type: "text", text: result }] };
});

// Export assistants back into /ai as *_prompt.txt files (reverse sync)
tool("exportAssistants", "Export project-scoped assistants into /ai as *_prompt.txt with YAML front-matter (optional clear)", {
  type: "object",
  properties: {
    clear: { type: "boolean", description: "If true, delete existing *_prompt.txt files before export" }
  },
  required: [],
  additionalProperties: false
}, async (args: any) => {
  if (!fs.existsSync(aiRoot)) fs.mkdirSync(aiRoot, { recursive: true });
  const list = await openai.beta.assistants.list({ limit: 100 });
  const filtered = list.data.filter(a => a.metadata && a.metadata.project === PROJECT_TAG);
  if (args.clear) {
    const existingFiles = gatherPromptFiles(aiRoot);
    for (const f of existingFiles) {
      fs.unlinkSync(f);
    }
  }
  const slug = (name: string) => name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 80); // keep filenames reasonable

  function resolveSubfolder(name: string): string {
    const normalized = name.toLowerCase().trim();
    const base = normalized.split(/[ _]/)[0];
    return base || 'misc';
  }
  const report: string[] = [];
  const now = new Date().toISOString();
  for (const a of filtered) {
    const safeName = a.name || a.id; // fallback to id if name is null
    const folder = path.join(aiRoot, resolveSubfolder(safeName));
    if (!fs.existsSync(folder)) fs.mkdirSync(folder, { recursive: true });
    const filename = path.join(folder, `${slug(safeName)}_prompt.txt`);
    const body = (a.instructions || '').replace(/\r\n/g, '\n').trim();
    const checksum = computeChecksum(body);
    // OpenAI object may not expose updated_at; fallback to retrieval time.
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
    report.push(`Exported ${a.id} -> ${path.relative(process.cwd(), filename)}`);
  }
  return { content: [{ type: "text", text: report.join('\n') || 'No assistants to export.' }] };
});

tool("validatePrompts", "Validate local *_prompt.txt files checksum against stored front-matter", { type: "object", properties: {}, additionalProperties: false }, async () => {
  const files = gatherPromptFiles(aiRoot);
  const results: string[] = [];
  for (const file of files) {
    const raw = fs.readFileSync(file, 'utf8');
    const { meta, body } = parseFrontMatterAndBody(raw);
    const stored = meta.checksum;
    const actual = computeChecksum(body.trim());
    if (!stored) {
      results.push(`${path.basename(file)}: MISSING checksum`);
    } else if (stored !== actual) {
      results.push(`${path.basename(file)}: FAIL (stored ${stored} != actual ${actual})`);
    } else {
      results.push(`${path.basename(file)}: OK`);
    }
  }
  return { content: [{ type: 'text', text: results.join('\n') || 'No prompt files found.' }] };
});

// Start server (stdio based)
(server as any).listen();
