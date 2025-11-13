import { describe, it, expect, vi } from 'vitest';
import { resolveAssistant } from '../src/engine/assistantMap.ts';
import { GameEngine } from '../src/engine/gameEngine.ts';

// Basic mapping tests
describe('assistant mapping', () => {
  it('resolves known action', () => {
    const a = resolveAssistant('travel');
    expect(a.name).toMatch(/Travel Resolver/);
  });
  it('falls back for unknown action', () => {
    const a = resolveAssistant('does-not-exist');
    expect(a.name).toMatch(/World Engine Resolver/);
  });
});

// Mock OpenAI client internals for process test without network
vi.mock('openai', () => {
  class FakeOpenAI {
    beta = {
      threads: {
        create: async () => ({ id: 'thread_mock' }),
        messages: {
          create: async () => ({}),
          list: async () => ({
            data: [
              { role: 'user', content: [] },
              { role: 'assistant', content: [{ text: { value: 'Hello world' } }] }
            ]
          })
        },
        runs: {
          create: async () => ({ id: 'run_mock', status: 'queued' }),
          retrieve: async () => ({ id: 'run_mock', status: 'completed' })
        }
      }
    };
    constructor(_: any) {}
  }
  return { default: FakeOpenAI };
});

describe('game engine processing', () => {
  it('processes a request and returns output', async () => {
    const engine = new GameEngine('fake-key');
    const response = await engine.process({ action: 'general-action', message: 'Ping', context: { foo: 'bar' } });
    expect(response.output.length).toBeGreaterThan(0);
    expect(response.threadId).toBe('thread_mock');
  });
});
