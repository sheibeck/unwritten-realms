import OpenAI from 'openai';
import dotenv from 'dotenv';
import { resolveAssistant } from './assistantMap.js';
import type { AssistantDescriptor } from './assistantMap.js';

dotenv.config();

export interface EngineRequest {
  action: string; // e.g. create-character | explore | travel | general-action | level-up
  message: string; // player message or command
  threadId?: string; // optional existing thread id for continuity
  context?: Record<string, any>; // auxiliary contextual data
}

export interface EngineResponse {
  assistant: AssistantDescriptor;
  threadId: string;
  runId: string;
  output: string[]; // aggregated textual outputs
  rawMessages: any[]; // original messages for advanced consumers
  elapsedMs: number;
}

export class GameEngine {
  private client: OpenAI;
  constructor(apiKey?: string) {
    this.client = new OpenAI({ apiKey: apiKey || process.env.OPENAI_API_KEY });
    if (!process.env.OPENAI_API_KEY && !apiKey) {
      console.warn('[GameEngine] OPENAI_API_KEY not set; requests will fail.');
    }
  }

  async process(req: EngineRequest): Promise<EngineResponse> {
    const started = Date.now();
    const assistant = resolveAssistant(req.action);

    // Reuse or create thread
    const threadId = req.threadId || (await this.client.beta.threads.create()).id;

    // Build composite content (similar to n8n formatted context)
    const formattedContext = req.context ? JSON.stringify(req.context, null, 2) : '{}';
    const composed = `Action: ${req.action}\nAssistant: ${assistant.name}\nMessage: ${req.message}\nContext:\n${formattedContext}`;

    await this.client.beta.threads.messages.create(threadId, {
      role: 'user',
      content: composed
    });

    const run = await this.client.beta.threads.runs.create(threadId, {
      assistant_id: assistant.id
    });

    // Poll until completion (basic implementation; could be optimized with event streams)
    let status = run.status;
    let currentRun = run;
    const timeoutMs = 1000 * 60; // 60s guard
    while (!['completed', 'failed', 'cancelled', 'expired'].includes(status)) {
      await new Promise(r => setTimeout(r, 750));
      currentRun = await this.client.beta.threads.runs.retrieve(threadId, run.id);
      status = currentRun.status;
      if (Date.now() - started > timeoutMs) {
        throw new Error(`Run timeout after ${timeoutMs}ms status=${status}`);
      }
    }

    if (status !== 'completed') {
      throw new Error(`Run ended with non-success status: ${status}`);
    }

    // Fetch messages
    const list = await this.client.beta.threads.messages.list(threadId, { order: 'asc' });
    const outputs: string[] = [];
    const raw: any[] = [];
    for (const m of list.data) {
      if (m.role === 'assistant') {
        const parts = m.content?.map(c => ('text' in c ? c.text.value : '')).filter(Boolean) || [];
        outputs.push(...parts);
      }
      raw.push(m);
    }

    return {
      assistant,
      threadId,
      runId: currentRun.id,
      output: outputs,
      rawMessages: raw,
      elapsedMs: Date.now() - started
    };
  }
}

// Convenience singleton if desired
export const gameEngine = new GameEngine();
