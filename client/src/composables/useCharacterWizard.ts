import { ref } from 'vue';
import type { WizardStepId } from '../../shared/wizard-steps';

type WizardIntent = 'assist' | 'select' | 'lock' | 'regenerate' | 'start_over';
type WizardOption = { name: string; description?: string; value?: string };

export function useCharacterWizard() {
    const stepId = ref<WizardStepId>('race');
    const wizardPrompt = ref<string>('');
    const options = ref<WizardOption[]>([]);
    const preview = ref<any>(null);
    const context = ref<Record<string, any>>({});
    const sessionId = ref<string | null>(null);
    const locked = ref(false);
    const nextStepId = ref<WizardStepId | null>(null);
    const loading = ref(false);
    const error = ref<string | null>(null);
    const data = ref<any>(null);

    function makeSessionId() {
        try {
            // browser crypto
            // @ts-ignore
            if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
        } catch (e) { }
        return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
    }

    function applyResult(body: any) {
        if (!body?.result) return;
        const res = body.result;
        stepId.value = res.stepId || stepId.value;
        wizardPrompt.value = res.prompt || '';
        options.value = (res.options ?? []) as WizardOption[];
        preview.value = res.preview ?? null;
        data.value = res.data ?? null;
        context.value = res.context || context.value;
        locked.value = Boolean(res.locked);
        nextStepId.value = res.nextStepId ?? null;
        if (res.sessionId) sessionId.value = res.sessionId;
    }

    async function callWizard(payload: Record<string, any>) {
        loading.value = true;
        error.value = null;
        try {
            const base: any = { ...payload };
            if (sessionId.value) base.session_id = sessionId.value;
            if (stepId.value) base.step_id = stepId.value;
            if (Object.keys(context.value || {}).length) base.context = context.value;
            const res = await fetch('/character-wizard/step', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(base)
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const body = await res.json();
            applyResult(body);
            return body;
        } catch (e: any) {
            error.value = e.message;
            return null;
        } finally {
            loading.value = false;
        }
    }

    async function startOver() {
        sessionId.value = sessionId.value || makeSessionId();
        context.value = {};
        options.value = [];
        preview.value = null;
        wizardPrompt.value = '';
        locked.value = false;
        nextStepId.value = null;
        return callWizard({ intent: 'start_over' satisfies WizardIntent });
    }

    async function assist(message: string) {
        return callWizard({ intent: 'assist' satisfies WizardIntent, message });
    }

    async function select(selection: string) {
        return callWizard({ intent: 'select' satisfies WizardIntent, selection });
    }

    async function lock(selection?: string) {
        return callWizard({ intent: 'lock' satisfies WizardIntent, selection });
    }

    // Initialize session id eagerly
    if (!sessionId.value) sessionId.value = makeSessionId();

    return {
        stepId,
        wizardPrompt,
        options,
        preview,
        context,
        sessionId,
        locked,
        nextStepId,
        loading,
        error,
        data,
        startOver,
        assist,
        select,
        lock
    };
}
