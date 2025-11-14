import express, { Request, Response } from 'express';
import dotenv from 'dotenv';
import { gameEngine } from '../src/engine/gameEngine.js';
import OpenAI from 'openai';
import { resolveAssistant, classifyAction } from '../src/engine/assistantMap.js';

dotenv.config();

export const app = express();
app.use(express.json());

// Health
app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});


// New direct assistant endpoint (bypasses gameEngine aggregate logic)
// Accepts either explicit assistantId or an action to classify/resolve
app.post('/assistant/run', async (req: Request, res: Response) => {
  const { assistantId, action, message, threadId, context, auto } = req.body || {};
  if (!message) return res.status(400).json({ error: 'Missing message' });
  try {
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({ error: 'OPENAI_API_KEY not configured' });
    }

    // Determine assistant descriptor
    let resolvedAssistantId = assistantId as string | undefined;
    let resolvedAction = action as string | undefined;
    if (!resolvedAssistantId) {
      // classify if requested or if action provided
      if (auto) {
        resolvedAction = classifyAction(message);
      } else if (action) {
        resolvedAction = action; // assume canonical action string
      } else {
        resolvedAction = 'world.general';
      }
      const descriptor = resolveAssistant(resolvedAction);
      resolvedAssistantId = descriptor.id;
    }

    const thread = threadId || (await client.beta.threads.create()).id;
    const formattedContext = context ? JSON.stringify(context, null, 2) : '{}';
    const composed = `Action: ${resolvedAction || 'direct'}\nMessage: ${message}\nContext:\n${formattedContext}`;
    await client.beta.threads.messages.create(thread, { role: 'user', content: composed });
    const run = await client.beta.threads.runs.create(thread, { assistant_id: resolvedAssistantId });

    // Poll until completion
    let status = run.status;
    let currentRun = run;
    const started = Date.now();
    const timeoutMs = 1000 * 60;
    while (!['completed', 'failed', 'cancelled', 'expired'].includes(status)) {
      await new Promise(r => setTimeout(r, 750));
      currentRun = await client.beta.threads.runs.retrieve(thread, run.id);
      status = currentRun.status;
      if (Date.now() - started > timeoutMs) {
        return res.status(504).json({ error: `Run timeout after ${timeoutMs}ms status=${status}` });
      }
    }
    if (status !== 'completed') {
      return res.status(500).json({ error: `Run ended with status ${status}` });
    }
    const list = await client.beta.threads.messages.list(thread, { order: 'asc' });
    const outputs: string[] = [];
    for (const m of list.data) {
      if (m.role === 'assistant') {
        const parts = m.content?.map(c => ('text' in c ? c.text.value : '')).filter(Boolean) || [];
        outputs.push(...parts);
      }
    }
    res.json({ assistantId: resolvedAssistantId, action: resolvedAction, threadId: thread, runId: currentRun.id, output: outputs });
  } catch (err: any) {
    console.error('[assistant/run] error', err);
    res.status(500).json({ error: err.message || 'Assistant run failure' });
  }
});

// Server-Sent Events streaming endpoint (poll-based incremental delivery)
// Emits events: meta, message, done, error.
app.post('/assistant/stream', async (req: Request, res: Response) => {
  const { assistantId, action, message, threadId, context, auto } = req.body || {};
  if (!message) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'Missing message' }));
  }
  if (!process.env.OPENAI_API_KEY) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'OPENAI_API_KEY not configured' }));
  }

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no'
  });

  const sendEvent = (event: string, data: any) => {
    res.write(`event: ${event}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  try {
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    let resolvedAssistantId = assistantId as string | undefined;
    let resolvedAction = action as string | undefined;
    if (!resolvedAssistantId) {
      if (auto) {
        resolvedAction = classifyAction(message);
      } else if (action) {
        resolvedAction = action; // assume canonical
      } else {
        resolvedAction = 'world.general';
      }
      const descriptor = resolveAssistant(resolvedAction);
      resolvedAssistantId = descriptor.id;
    }

    const thread = threadId || (await client.beta.threads.create()).id;
    const formattedContext = context ? JSON.stringify(context, null, 2) : '{}';
    const composed = `Action: ${resolvedAction || 'direct'}\nMessage: ${message}\nContext:\n${formattedContext}`;
    await client.beta.threads.messages.create(thread, { role: 'user', content: composed });
    const run = await client.beta.threads.runs.create(thread, { assistant_id: resolvedAssistantId });
    sendEvent('meta', { threadId: thread, runId: run.id, assistantId: resolvedAssistantId, action: resolvedAction });

    let status = run.status;
    let currentRun = run;
    const started = Date.now();
    const timeoutMs = 1000 * 60;
    const emittedMessageIds = new Set<string>();
    const collectedOutputs: string[] = [];

    while (!['completed', 'failed', 'cancelled', 'expired'].includes(status)) {
      await new Promise(r => setTimeout(r, 700));
      currentRun = await client.beta.threads.runs.retrieve(thread, run.id);
      status = currentRun.status;
      const list = await client.beta.threads.messages.list(thread, { order: 'asc' });
      for (const m of list.data) {
        if (m.role === 'assistant' && !emittedMessageIds.has(m.id)) {
          emittedMessageIds.add(m.id);
          const parts = m.content?.map(c => ('text' in c ? c.text.value : '')).filter(Boolean) || [];
          for (const p of parts) {
            sendEvent('message', { text: p });
            collectedOutputs.push(p);
          }
        }
      }
      if (Date.now() - started > timeoutMs) {
        sendEvent('error', { error: `Run timeout after ${timeoutMs}ms status=${status}` });
        return res.end();
      }
    }

    if (status !== 'completed') {
      sendEvent('error', { error: `Run ended with status ${status}` });
      return res.end();
    }

    const finalList = await client.beta.threads.messages.list(thread, { order: 'asc' });
    for (const m of finalList.data) {
      if (m.role === 'assistant' && !emittedMessageIds.has(m.id)) {
        emittedMessageIds.add(m.id);
        const parts = m.content?.map(c => ('text' in c ? c.text.value : '')).filter(Boolean) || [];
        for (const p of parts) {
          sendEvent('message', { text: p });
          collectedOutputs.push(p);
        }
      }
    }
    // Consolidated full output for clients wanting final payload
    sendEvent('result', { threadId: thread, runId: currentRun.id, assistantId: resolvedAssistantId, action: resolvedAction, output: collectedOutputs });
    sendEvent('done', { threadId: thread, runId: currentRun.id });
    res.end();
  } catch (err: any) {
    console.error('[assistant/stream] error', err);
    sendEvent('error', { error: err.message || 'Assistant stream failure' });
    res.end();
  }
});

if (process.env.NODE_ENV !== 'test') {
  const port = process.env.ENGINE_PORT || 8787;
  app.listen(port, () => {
    console.log(`[Engine] Listening on port ${port}`);
  });
}
