import { ref } from 'vue';

interface ThreadSummary { threadId: string; createdAt: number; origin?: string; }
interface MessageRecord { id: string; role: string; createdAt: number; content: string[]; }

const ENGINE_BASE = (import.meta as any).env?.VITE_ENGINE_BASE_URL || 'http://localhost:8787';
function url(p: string) { return `${ENGINE_BASE.replace(/\/$/, '')}${p}`; }

export function useThreadsApi() {
    const threads = ref<ThreadSummary[]>([]);
    const messages = ref<MessageRecord[]>([]);
    const loading = ref(false);
    const error = ref<string | null>(null);

    async function listThreads() {
        loading.value = true; error.value = null;
        try {
            const res = await fetch(url('/assistant/threads'));
            if (!res.ok) throw new Error(`List threads failed ${res.status}`);
            const data = await res.json();
            threads.value = data.threads || [];
        } catch (e: any) { error.value = e.message; } finally { loading.value = false; }
    }

    async function createThread(initialMessage?: string, context?: Record<string, any>) {
        loading.value = true; error.value = null;
        try {
            const res = await fetch(url('/assistant/threads'), {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ initialMessage, context })
            });
            if (!res.ok) throw new Error(`Create thread failed ${res.status}`);
            const data = await res.json();
            await listThreads();
            return data.threadId as string;
        } catch (e: any) { error.value = e.message; return null; } finally { loading.value = false; }
    }

    async function listMessages(threadId: string) {
        loading.value = true; error.value = null; messages.value = [];
        try {
            const res = await fetch(url(`/assistant/threads/${threadId}/messages`));
            if (!res.ok) throw new Error(`List messages failed ${res.status}`);
            const data = await res.json();
            messages.value = data.messages || [];
        } catch (e: any) { error.value = e.message; } finally { loading.value = false; }
    }

    async function addMessage(threadId: string, message: string, context?: Record<string, any>) {
        loading.value = true; error.value = null;
        try {
            const res = await fetch(url(`/assistant/threads/${threadId}/messages`), {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message, context })
            });
            if (!res.ok) throw new Error(`Add message failed ${res.status}`);
            await listMessages(threadId);
        } catch (e: any) { error.value = e.message; } finally { loading.value = false; }
    }

    async function forgetThread(threadId: string) {
        loading.value = true; error.value = null;
        try {
            const res = await fetch(url(`/assistant/threads/${threadId}`), { method: 'DELETE' });
            if (!res.ok) throw new Error(`Forget thread failed ${res.status}`);
            await listThreads();
        } catch (e: any) { error.value = e.message; } finally { loading.value = false; }
    }

    return { threads, messages, loading, error, listThreads, createThread, listMessages, addMessage, forgetThread };
}