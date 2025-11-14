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
            let receivedChunk = false;

            await startStream({
                message: currentMessage,
                action: 'character.create',
                threadId: threadId,
                context: deps.buildContext(),
                onMeta: (m) => { threadId = m.threadId; },
                onChunk: async (text) => {
                    receivedChunk = true;
                    let parsed: any; try { parsed = JSON.parse(text); } catch { parsed = null; }
                    if (parsed?.narrative) {
                        await deps.pushMessage(parsed.narrative);
                        finalJson = parsed;
                    } else {
                        await deps.pushMessage(text);
                    }
                },
                onResult: async (res) => {
                    // Join all output parts; assistant JSON may be split across multiple content parts.
                    const joined = res.output.join('\n');
                    let parsed: any = null;
                    // Try direct parse first.
                    try { parsed = JSON.parse(joined); } catch { /* ignore */ }
                    if (!parsed) {
                        // Attempt to extract first JSON object substring.
                        const firstBrace = joined.indexOf('{');
                        const lastBrace = joined.lastIndexOf('}');
                        if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
                            const candidate = joined.slice(firstBrace, lastBrace + 1).trim();
                            try { parsed = JSON.parse(candidate); } catch { /* ignore */ }
                        }
                    }
                    if (!parsed) {
                        // Fallback: treat entire joined text as narrative.
                        parsed = { narrative: joined };
                    }
                    finalJson = parsed;
                    if (import.meta.env.DEV) console.debug('[characterCreation] parsed result JSON', finalJson);
                    if (finalJson.narrative) {
                        await deps.pushMessage(finalJson.narrative);
                    }
                    if (finalJson.actions?.createCharacter) {
                        const character = finalJson.actions.createCharacter as AddCharacter;
                        // Improved completeness: allow numeric 0 values; require non-null/undefined; for strings require non-empty.
                        const missing: string[] = [];
                        for (const [key, value] of Object.entries(character)) {
                            if (value === null || value === undefined) { missing.push(key); continue; }
                            if (typeof value === 'string' && value.trim() === '') missing.push(key);
                        }
                        const complete = missing.length === 0;
                        if (complete) {
                            emitPhase('CONFIRMATION', deps.mainStore.currentUserId || null);
                            await deps.characterStore.addCharacter(character);
                            const charId = (character as any).characterId || (character as any).id || null;
                            emitPhase('PERSISTENCE', deps.mainStore.currentUserId || null, { characterId: charId });
                            deps.updateMainThread(res.threadId);
                        }
                    }
                    else {
                        // No createCharacter action returned; prompt user for refinement keywords.
                        await deps.pushMessage('🧙 Provide more details (origin, class, traits) to refine your character.');
                    }
                },
                onDone: async () => { },
                onError: async (err) => {
                    if (err === 'aborted') return;
                    console.error('Character creation stream error:', err);
                    await deps.pushMessage('❌ Character creation stream failed. Retrying with non-stream endpoint...');
                    emitPhase('ERROR', deps.mainStore.currentUserId || null, { reason: 'character_creation_stream_failed' });
                }
            });

            // Fallback if stream produced no chunks/result
            if (!receivedChunk && !finalJson) {
                if (import.meta.env.DEV) console.debug('[characterCreation] no stream chunks; invoking /assistant/run fallback');
                try {
                    const response = await fetch('/assistant/run', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ action: 'character.create', message: currentMessage, threadId, context: deps.buildContext() })
                    });
                    if (response.ok) {
                        const data = await response.json();
                        const last = data.output[data.output.length - 1] || '{}';
                        let parsed: any; try { parsed = JSON.parse(last); } catch { parsed = { narrative: last }; }
                        if (parsed.narrative) await deps.pushMessage(`🧙 ${parsed.narrative}`);
                        finalJson = parsed;
                        if (finalJson.actions?.createCharacter) {
                            const character = finalJson.actions.createCharacter as AddCharacter;
                            const complete = Object.values(character).every(v => v !== null && v !== undefined && v !== 0 && v !== '');
                            if (complete) {
                                emitPhase('CONFIRMATION', deps.mainStore.currentUserId || null);
                                await deps.characterStore.addCharacter(character);
                                const charId = (character as any).characterId || (character as any).id || null;
                                emitPhase('PERSISTENCE', deps.mainStore.currentUserId || null, { characterId: charId });
                            }
                        }
                    } else {
                        if (import.meta.env.DEV) console.error('[characterCreation] fallback /assistant/run non-OK', response.status);
                        await deps.pushMessage('❌ Character creation fallback failed.');
                    }
                } catch (e) {
                    console.error('Character creation fallback error', e);
                    await deps.pushMessage('❌ Character creation fallback error.');
                }
            }

            if (deps.characterStore.currentCharacter?.characterId) break;
            currentMessage = await getNextUserInput();
            await deps.pushMessage(`🗨️ You: ${currentMessage}`);
            iteration++;
        }
    }

    return { handleCharacterCreationLoopStreaming };
}
