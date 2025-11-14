import { useAssistantStream } from '@/composables/useAssistantStream';
import { shouldStream } from '@/engine/endpointPolicy';

interface AiHandlerDeps {
    characterStore: any;
    regionStore: any;
    questStore: any;
    npcStore: any;
    mainStore: any;
    activeGameThreadId: any; // ref
    updateMainThread: (id: string) => void;
    buildContext: () => Record<string, any>;
    resolveLocalAction: (msg: string, override?: boolean) => string;
    pushMessage: (msg: string) => Promise<void> | void;
    getErrorMessage: () => string;
    getNextUserInput: () => Promise<string>;
    handleCharacterCreationLoopStreaming: (initialMessage: string, getNextUserInput: () => Promise<string>) => Promise<void>;
}

export function useAiHandler(deps: AiHandlerDeps) {
    const { startStream } = useAssistantStream();
    const isStreaming = { value: false };

    function buildPayload(action: string, message: string, additional: Record<string, any> = {}) {
        return { action, message, characterId: deps.characterStore.currentCharacter?.characterId ?? null, context: additional, threadId: null as string | null };
    }

    async function handleAiResponse(response: any, originalAction: string) {
        const assistantOutputArr: string[] = response.output || [];
        const assistantOutput = assistantOutputArr[assistantOutputArr.length - 1] || '';
        let jsonOutput: any;
        try { jsonOutput = JSON.parse(assistantOutput); } catch { jsonOutput = { narrative: assistantOutput }; }

        await deps.pushMessage(`🧙 ${jsonOutput.narrative}`);
        if (!jsonOutput.actions) return;

        if (jsonOutput.actions.createCharacter) {
            const character = jsonOutput.actions.createCharacter;
            const allPropsHaveValues = Object.values(character).every((v: any) => v !== null && v !== undefined && v !== 0 && v !== '');
            if (allPropsHaveValues) {
                await deps.characterStore.addCharacter(character);
            }
        }
        if (jsonOutput.actions.createRegion) {
            const region = jsonOutput.actions.createRegion;
            region.fullDescription = jsonOutput.narrative;
            region.fromRegionId = deps.characterStore.currentCharacter?.currentLocation;
            region.travelEnergyCost = 100;
            await deps.regionStore.createAndLinkNewRegion(region);
        }

        if (originalAction === 'world.general' || originalAction === 'character.create') {
            deps.updateMainThread(response.threadId || deps.activeGameThreadId.value);
        }
    }

    async function sendMessage(overrideMessage = false, msg = '', additionalData: Record<string, any> = {}) {
        const message = overrideMessage ? msg : msg.trim();
        if (!message) return;
        const action = deps.resolveLocalAction(message, overrideMessage);

        if (action === 'character.create') {
            await deps.handleCharacterCreationLoopStreaming(message, deps.getNextUserInput);
            return;
        }

        if (['region.create', 'world.general'].includes(action)) {
            const payload = buildPayload(action, message, { ...deps.buildContext(), ...additionalData });
            if (deps.activeGameThreadId.value) payload.threadId = deps.activeGameThreadId.value;
            const canonicalAction = action;
            if (shouldStream(canonicalAction)) {
                isStreaming.value = true;
                await startStream({
                    message: payload.message,
                    action: canonicalAction,
                    context: payload.context,
                    threadId: payload.threadId,
                    onChunk: async (text) => {
                        let parsed: any; try { parsed = JSON.parse(text); } catch { parsed = null; }
                        if (parsed?.narrative) await deps.pushMessage(`🧙 ${parsed.narrative}`); else await deps.pushMessage(`🧙 ${text}`);
                    },
                    onResult: async (res) => {
                        isStreaming.value = false;
                        await handleAiResponse(res, action);
                    },
                    onError: async (err) => {
                        if (err === 'aborted') return;
                        isStreaming.value = false;
                        try {
                            const response = await fetch('/assistant/run', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json', 'Origin': 'localhost' },
                                body: JSON.stringify({ message: payload.message, action: canonicalAction, context: payload.context, threadId: payload.threadId, auto: false })
                            });
                            if (response.ok) {
                                const result = await response.json();
                                await handleAiResponse(result, action);
                            } else {
                                await deps.pushMessage(deps.getErrorMessage());
                            }
                        } catch (e) {
                            console.error('Fallback fetch error:', e);
                            await deps.pushMessage(deps.getErrorMessage());
                        }
                    }
                });
            } else {
                try {
                    const response = await fetch('/assistant/run', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'Origin': 'localhost' },
                        body: JSON.stringify({ message: payload.message, action: canonicalAction, context: payload.context, threadId: payload.threadId, auto: false })
                    });
                    if (response.ok) {
                        const result = await response.json();
                        await handleAiResponse(result, action);
                    } else {
                        await deps.pushMessage(deps.getErrorMessage());
                    }
                } catch (e) {
                    console.error('Run endpoint error:', e);
                    await deps.pushMessage(deps.getErrorMessage());
                }
            }
        }
    }

    return { sendMessage, handleAiResponse };
}
