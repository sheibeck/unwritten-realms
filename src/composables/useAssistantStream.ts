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
                throw new Error(`Stream init failed status=${res.status}`);
            }

            const reader = res.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                buffer += decoder.decode(value, { stream: true });

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
                            opts.onMeta?.(payload);
                            break;
                        case 'message':
                            if (payload.text) opts.onChunk?.(payload.text);
                            break;
                        case 'result':
                            if (payload.output) {
                                opts.onResult?.({ threadId: payload.threadId, runId: payload.runId, assistantId: payload.assistantId, action: payload.action, output: payload.output });
                            }
                            break;
                        case 'done':
                            opts.onDone?.({ threadId: payload.threadId, runId: payload.runId });
                            break;
                        case 'error':
                            opts.onError?.(payload.error || 'stream error');
                            break;
                    }
                }
            }
        } catch (err: any) {
            if (err?.name === 'AbortError') {
                opts.onError?.('aborted');
            } else {
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
