import { beforeAll, afterAll, describe, it, expect, vi } from 'vitest';

vi.mock('openai', () => {
    class FakeOpenAI {
        beta: any;
        constructor(_opts: any) {
            this.beta = {
                threads: {
                    create: async () => ({ id: 'thread_stream' }),
                    messages: {
                        create: async () => ({ id: 'msg_user' }),
                        list: async () => ({
                            data: [
                                {
                                    id: 'assistant_msg_1',
                                    role: 'assistant',
                                    content: [{ text: { value: JSON.stringify({ narrative: 'Streaming hello!', actions: {} }) } }]
                                }
                            ]
                        })
                    },
                    runs: {
                        create: async () => ({ id: 'run_stream', status: 'queued' }),
                        retrieve: async () => ({ id: 'run_stream', status: 'completed' })
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

describe('/assistant/stream SSE', () => {
    it('emits meta, message, result, done events', async () => {
        const res = await fetch(`${baseURL}/assistant/stream`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: 'Hi', action: 'world.general' })
        });
        const text = await res.text();
        expect(text).toMatch(/event: meta/);
        expect(text).toMatch(/event: message/);
        expect(text).toMatch(/Streaming hello!/);
        expect(text).toMatch(/event: result/);
        expect(text).toMatch(/event: done/);
    });

    it('errors when message missing', async () => {
        const res = await fetch(`${baseURL}/assistant/stream`, { method: 'POST' });
        expect(res.status).toBe(400);
        const body = await res.text();
        expect(body).toMatch(/Missing message/);
    });
});
