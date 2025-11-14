import { ref } from 'vue';

export interface StreamOptions {
    message: string;
    action: string;
    context?: Record<string, any>;
    threadId?: string | null;
    auto?: boolean;
    onMeta?: (meta: any) => void;
    onChunk?: (text: string) => void;
    onResult?: (result: { threadId: string; runId: string; assistantId?: string; action?: string; output: string[] }) => void;
    onDone?: (final: { threadId: string; runId: string }) => void;
    onError?: (err: string) => void;
    onStatus?: (status: { status: string; loopCount: number }) => void;
    onDebug?: (info: any) => void;
}

// Consumes POST /assistant/stream using fetch + ReadableStream parsing of SSE frames.
// Returns an abort controller so callers can cancel.
export function useAssistantStream() {
    const isStreaming = ref(false);
    const abortController = ref<AbortController | null>(null);

    async function startStream(opts: StreamOptions) {
        if (isStreaming.value) throw new Error('Stream already in progress');
        isStreaming.value = true;
        const controller = new AbortController();
        abortController.value = controller;

        try {
            // Debug: starting stream request
            if (import.meta.env.DEV) console.debug('[assistantStream] initiating POST /assistant/stream');
            const res = await fetch('/assistant/stream', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: opts.message,
                    action: opts.action,
                    context: opts.context,
                    threadId: opts.threadId,
                    auto: opts.auto || false
                }),
                signal: controller.signal
            });

            if (!res.ok || !res.body) {
                if (import.meta.env.DEV) console.error('[assistantStream] initial response not ok', res.status);
                throw new Error(`Stream init failed status=${res.status}`);
            }

            const reader = res.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';
            let receivedAny = false;
            const startTs = Date.now();
            const WATCHDOG_MS = 20000; // 20s fallback threshold

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                buffer += decoder.decode(value, { stream: true });
                if (!receivedAny) receivedAny = true;

                // Split on double newline indicating SSE event termination
                const frames = buffer.split(/\n\n/);
                buffer = frames.pop() || '';

                for (const frame of frames) {
                    if (!frame.trim()) continue;
                    const lines = frame.split(/\n/);
                    let eventType = 'message';
                    let dataRaw = '';
                    for (const l of lines) {
                        if (l.startsWith('event:')) eventType = l.slice(6).trim();
                        if (l.startsWith('data:')) dataRaw += l.slice(5).trim();
                    }
                    if (!dataRaw) continue;
                    let payload: any;
                    try { payload = JSON.parse(dataRaw); } catch { continue; }

                    switch (eventType) {
                        case 'meta':
                            if (import.meta.env.DEV) console.debug('[assistantStream] meta', payload);
                            opts.onMeta?.(payload);
                            break;
                        case 'message':
                            if (payload.text) opts.onChunk?.(payload.text);
                            break;
                        case 'status':
                            if (import.meta.env.DEV) console.debug('[assistantStream] status', payload);
                            opts.onStatus?.(payload);
                            break;
                        case 'debug':
                            if (import.meta.env.DEV) console.debug('[assistantStream] debug', payload);
                            opts.onDebug?.(payload);
                            break;
                        case 'result':
                            if (import.meta.env.DEV) console.debug('[assistantStream] result received');
                            if (payload.output) {
                                opts.onResult?.({ threadId: payload.threadId, runId: payload.runId, assistantId: payload.assistantId, action: payload.action, output: payload.output });
                            }
                            break;
                        case 'done':
                            if (import.meta.env.DEV) console.debug('[assistantStream] done');
                            opts.onDone?.({ threadId: payload.threadId, runId: payload.runId });
                            break;
                        case 'error':
                            if (import.meta.env.DEV) console.error('[assistantStream] error event', payload);
                            opts.onError?.(payload.error || 'stream error');
                            break;
                    }
                }
                // Watchdog: if no data at all within threshold, abort to trigger fallback
                if (!receivedAny && Date.now() - startTs > WATCHDOG_MS) {
                    controller.abort();
                    opts.onError?.('watchdog-timeout');
                    break;
                }
            }
        } catch (err: any) {
            if (err?.name === 'AbortError') {
                opts.onError?.('aborted');
            } else {
                if (import.meta.env.DEV) console.error('[assistantStream] exception', err);
                opts.onError?.(err.message || 'stream failure');
            }
        } finally {
            isStreaming.value = false;
            abortController.value = null;
        }
    }

    function abort() {
        abortController.value?.abort();
    }

    return { isStreaming, startStream, abort };
}
