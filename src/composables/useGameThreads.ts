import { ref } from 'vue';

export function useGameThreads() {
    const activeGameThreadId = ref<string | null>(null);

    function updateMainThread(threadId: string) {
        if (threadId) localStorage.setItem('unwrittenRealmsThreadId', threadId);
        activeGameThreadId.value = threadId;
    }

    function initFromStorage() {
        // Always start with a new session: clear any previous threadId
        localStorage.removeItem('unwrittenRealmsThreadId');
        activeGameThreadId.value = null;
    }

    return { activeGameThreadId, updateMainThread, initFromStorage };
}
