import express, { Request, Response } from 'express';
import dotenv from 'dotenv';
import { gameEngine } from '../src/engine/gameEngine.js';

dotenv.config();

const app = express();
app.use(express.json());

// Health
app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// Unified webhook endpoint replacing n8n /uwengine
app.post('/uwengine', async (req: Request, res: Response) => {
  const { action, message, threadId, context } = req.body || {};
  if (!message) {
    return res.status(400).json({ error: 'Missing message' });
  }
  try {
    const response = await gameEngine.process({
      action: action || 'unknown',
      message,
      threadId,
      context
    });
    res.json({
      assistant: response.assistant.name,
      assistant_id: response.assistant.id,
      threadId: response.threadId,
      runId: response.runId,
      output: response.output,
      elapsedMs: response.elapsedMs
    });
  } catch (err: any) {
    console.error('[uwengine] error', err);
    res.status(500).json({ error: err.message || 'Engine failure' });
  }
});

const port = process.env.ENGINE_PORT || 8787;
app.listen(port, () => {
  console.log(`[Engine] Listening on port ${port}`);
});
