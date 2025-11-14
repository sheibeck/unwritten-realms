import { beforeAll, afterAll, describe, it, expect, vi } from 'vitest';

// Mock OpenAI before importing server code so chained imports also use mock
vi.mock('openai', () => {
    class FakeOpenAI {
        beta: any;
        constructor(_opts: any) {
            this.beta = {
                threads: {
                    create: async () => ({ id: 'thread_test' }),
                    messages: {
                        create: async (_threadId: string, _payload: any) => ({ id: 'msg_user' }),
                        list: async () => ({
                            data: [
                                {
                                    role: 'assistant',
                                    content: [{ text: { value: JSON.stringify({ narrative: 'Hello adventurer!', actions: {} }) } }]
                                }
                            ]
                        })
                    },
                    runs: {
                        create: async (_threadId: string, _payload: any) => ({ id: 'run_test', status: 'queued' }),
                        retrieve: async (_threadId: string, _runId: string) => ({ id: 'run_test', status: 'completed' })
                    }
                }
            };
        }
    }
    return { default: FakeOpenAI };
});

process.env.OPENAI_API_KEY = 'test-key';
process.env.NODE_ENV = 'test';

import { app } from '../scripts/engine-server.js';
import http from 'http';

let server: http.Server;
let baseURL: string;

beforeAll(async () => {
    server = app.listen(0);
    const addr = server.address();
    if (addr && typeof addr === 'object') {
        baseURL = `http://127.0.0.1:${addr.port}`;
    }
});

afterAll(async () => {
    await new Promise(r => server.close(r));
});

async function post(path: string, body: any) {
    const res = await fetch(`${baseURL}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    });
    const json = await res.json().catch(() => undefined);
    return { status: res.status, json };
}

describe('/assistant/run endpoint', () => {
    it('returns 400 when message missing', async () => {
        const { status, json } = await post('/assistant/run', { action: 'world.general' });
        expect(status).toBe(400);
        expect(json.error).toMatch(/Missing message/i);
    });

    it('successfully returns output array', async () => {
        const { status, json } = await post('/assistant/run', { message: 'Test', action: 'world.general' });
        expect(status).toBe(200);
        expect(json.output).toBeDefined();
        expect(Array.isArray(json.output)).toBe(true);
        expect(json.output[0]).toMatch(/Hello adventurer/);
        expect(json.action).toBe('world.general');
        expect(json.threadId).toBe('thread_test');
    });

    it('honors assistantId override', async () => {
        const { status, json } = await post('/assistant/run', { message: 'Direct', assistantId: 'asst_custom' });
        expect(status).toBe(200);
        expect(json.assistantId).toBe('asst_custom');
    });
});

// Optionally ensure /uwengine is gone
describe('legacy /uwengine removed', () => {
    it('returns 404 for removed route', async () => {
        const res = await fetch(`${baseURL}/uwengine`, { method: 'POST' });
        expect(res.status).toBe(404);
    });
});
