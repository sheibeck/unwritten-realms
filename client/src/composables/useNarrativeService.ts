import { ref } from 'vue';

export function useNarrativeService() {
    const baseUrl = import.meta.env.VITE_NARRATIVE_URL || 'http://localhost:8081';
    const loading = ref(false);
    const error = ref<string | null>(null);

    async function interpret(text: string, character_context: unknown, world_context: unknown) {
        loading.value = true;
        error.value = null;
        try {
            const res = await fetch(`${baseUrl}/interpret`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text, character_context, world_context })
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            return await res.json();
        } catch (e: any) {
            error.value = e.message;
            return null;
        } finally {
            loading.value = false;
        }
    }

    return { interpret, loading, error };
}
