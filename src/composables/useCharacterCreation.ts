import { AddCharacter } from '@/spacetimedb/client';
import { useAssistantStream } from '@/composables/useAssistantStream';
import { emitPhase } from '@/engine/onboardingEvents';

interface CharacterCreationDeps {
    characterStore: any;
    mainStore: any;
    buildContext: () => Record<string, any>;
    pushMessage: (msg: string) => Promise<void> | void;
    updateMainThread: (threadId: string) => void;
}

export function useCharacterCreation(deps: CharacterCreationDeps) {
    const { startStream } = useAssistantStream();

    async function handleCharacterCreationLoopStreaming(initialMessage: string, getNextUserInput: () => Promise<string>) {
        let currentMessage = initialMessage;
        let iteration = 0;
        let threadId: string | null = null;

        while (!deps.characterStore.currentCharacter?.characterId) {
            emitPhase(iteration === 0 ? 'CONCEPT' : 'REFINEMENT', deps.mainStore.currentUserId || null, { iteration });
            let finalJson: any = null;

            await startStream({
                message: currentMessage,
                action: 'character.create',
                threadId: threadId,
                context: deps.buildContext(),
                onMeta: (m) => { threadId = m.threadId; },
                onChunk: async (text) => {
                    let parsed: any; try { parsed = JSON.parse(text); } catch { parsed = null; }
                    if (parsed?.narrative) {
                        await deps.pushMessage(`🧙 ${parsed.narrative}`);
                        finalJson = parsed;
                    } else {
                        await deps.pushMessage(`🧙 ${text}`);
                    }
                },
                onResult: async (res) => {
                    const last = res.output[res.output.length - 1] || '{}';
                    let parsed: any; try { parsed = JSON.parse(last); } catch { parsed = { narrative: last }; }
                    finalJson = parsed;
                    if (finalJson.actions?.createCharacter) {
                        const character = finalJson.actions.createCharacter as AddCharacter;
                        const complete = Object.values(character).every(v => v !== null && v !== undefined && v !== 0 && v !== '');
                        if (complete) {
                            emitPhase('CONFIRMATION', deps.mainStore.currentUserId || null);
                            await deps.characterStore.addCharacter(character);
                            const charId = (character as any).characterId || (character as any).id || null;
                            emitPhase('PERSISTENCE', deps.mainStore.currentUserId || null, { characterId: charId });
                            deps.updateMainThread(res.threadId);
                        }
                    }
                },
                onDone: async () => { },
                onError: async (err) => {
                    if (err === 'aborted') return;
                    console.error('Character creation stream error:', err);
                    await deps.pushMessage('❌ Character creation stream failed.');
                    emitPhase('ERROR', deps.mainStore.currentUserId || null, { reason: 'character_creation_stream_failed' });
                }
            });

            if (deps.characterStore.currentCharacter?.characterId) break;
            currentMessage = await getNextUserInput();
            await deps.pushMessage(`🗨️ You: ${currentMessage}`);
            iteration++;
        }
    }

    return { handleCharacterCreationLoopStreaming };
}
