import { ref } from 'vue';

export function useGameThreads() {
    const activeGameThreadId = ref<string | null>(null);

    function updateMainThread(threadId: string) {
        if (threadId) localStorage.setItem('unwrittenRealmsThreadId', threadId);
        activeGameThreadId.value = threadId;
    }

    function initFromStorage() {
        activeGameThreadId.value = localStorage.getItem('unwrittenRealmsThreadId');
    }

    return { activeGameThreadId, updateMainThread, initFromStorage };
}
