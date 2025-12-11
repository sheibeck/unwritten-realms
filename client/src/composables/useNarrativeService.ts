import { ref } from 'vue';

export function useNarrativeService() {
    // Default to the Vite dev proxy prefix to avoid mixed-content/CORS in https dev
    const baseUrl = import.meta.env.VITE_NARRATIVE_SERVICE_URL || '/narrative';
    const loading = ref(false);
    const error = ref<string | null>(null);

    async function interpret(text: string, character_context: unknown, world_context: unknown) {
        loading.value = true;
        error.value = null;
        try {
            // Only include context fields when they are non-empty objects
            const body: any = { text };
            const isNonEmptyObject = (v: any) => v && typeof v === 'object' && Object.keys(v).length > 0;
            if (isNonEmptyObject(character_context)) body.character_context = character_context;
            if (isNonEmptyObject(world_context)) body.world_context = world_context;

            const res = await fetch(`${baseUrl}/interpret`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
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
