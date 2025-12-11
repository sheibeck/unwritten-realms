import { ref } from 'vue';

export function useCharacterWizard() {
    const step = ref(1);
    const name = ref('');
    const race = ref('');
    const archetype = ref('');
    const profession = ref<any>(null);
    const loading = ref(false);
    const error = ref<string | null>(null);
    const sessionId = ref<string | null>(null);
    const wizardPrompt = ref<string>('');
    const options = ref<any[]>([]);
    const data = ref<any>(null);
    const context = ref<any>({});

    function makeSessionId() {
        try {
            // browser crypto
            // @ts-ignore
            if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
        } catch (e) { }
        return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
    }

    async function generateProfession() {
        loading.value = true;
        error.value = null;
        try {
            const res = await fetch('/profession/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ race: race.value, archetype: archetype.value })
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();
            profession.value = data.profession;
            return profession.value;
        } catch (e: any) {
            error.value = e.message;
            return null;
        } finally {
            loading.value = false;
        }
    }

    async function startStep() {
        loading.value = true;
        error.value = null;
        try {
            // Ensure a fresh session id exists for a new conversation
            if (!sessionId.value) sessionId.value = makeSessionId();
            const payload: any = { step: 1 };
            if (sessionId.value) payload.session_id = sessionId.value;
            if (Object.keys(context.value || {}).length) payload.context = context.value;
            const res = await fetch('/character-wizard/step', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const body = await res.json();
            if (body.result) {
                wizardPrompt.value = body.result.prompt ?? '';
                // Normalize options to { name, description, raw }
                options.value = (body.result.options ?? []).map((o: any) => {
                    if (typeof o === 'string') return { name: o, description: '', raw: o };
                    return { name: o.name ?? o.race ?? o.title ?? o.label ?? '', description: o.description ?? o.desc ?? '', raw: o };
                });
                data.value = body.result.data ?? null;
                // merge returned data into context for subsequent steps
                if (body.result.data && typeof body.result.data === 'object') {
                    context.value = { ...context.value, ...body.result.data };
                }
                sessionId.value = body.session_id ?? sessionId.value;
            }
            return body;
        } catch (e: any) {
            error.value = e.message;
            return null;
        } finally {
            loading.value = false;
        }
    }

    async function submitStep(input: string) {
        loading.value = true;
        error.value = null;
        try {
            // Immediately record common choice types into context so subsequent requests include them
            if (step.value === 1 && input) {
                context.value = { ...context.value, race: input };
            }
            if (step.value === 2 && input) {
                context.value = { ...context.value, archetype: input };
            }
            if (step.value === 3 && input) {
                context.value = { ...context.value, profession: input };
            }
            if (step.value === 4 && input) {
                context.value = { ...context.value, starting_region: input };
            }
            if (step.value === 5 && input) {
                context.value = { ...context.value, visual_description: input };
            }
            if (step.value === 6 && input) {
                context.value = { ...context.value, name: input };
            }
            const payload: any = { input, step: step.value };
            if (sessionId.value) payload.session_id = sessionId.value;
            if (Object.keys(context.value || {}).length) payload.context = context.value;
            const res = await fetch('/character-wizard/step', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const body = await res.json();
            if (body.result) {
                // update based on parsed result
                wizardPrompt.value = body.result.prompt ?? '';
                options.value = (body.result.options ?? []).map((o: any) => {
                    if (typeof o === 'string') return { name: o, description: '', raw: o };
                    return { name: o.name ?? o.race ?? o.title ?? o.label ?? '', description: o.description ?? o.desc ?? '', raw: o };
                });
                data.value = body.result.data ?? null;
                if (body.result.data && typeof body.result.data === 'object') {
                    context.value = { ...context.value, ...body.result.data };
                }
                // advance step if model returned step
                if (body.result.step) step.value = body.result.step;
            }
            return body;
        } catch (e: any) {
            error.value = e.message;
            return null;
        } finally {
            loading.value = false;
        }
    }

    function reset() {
        step.value = 1;
        name.value = '';
        race.value = '';
        archetype.value = '';
        profession.value = null;
        error.value = null;
        // clear accumulated context and data, and start a fresh session
        context.value = {};
        data.value = null;
        wizardPrompt.value = '';
        options.value = [];
        sessionId.value = makeSessionId();
    }

    // Initialize with a fresh session id when the composable is created
    if (!sessionId.value) sessionId.value = makeSessionId();

    return { step, name, race, archetype, profession, loading, error, generateProfession, reset, sessionId, wizardPrompt, options, data, startStep, submitStep };
}
