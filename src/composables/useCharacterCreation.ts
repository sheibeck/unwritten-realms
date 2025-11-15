import { useAssistantStream } from '@/composables/useAssistantStream';
import { emitPhase } from '@/engine/onboardingEvents';

interface CharacterCreationDeps {
    characterStore: any;
    mainStore: any;
    regionStore: any; // new: for provisioning starter region
    buildContext: () => Record<string, any>;
    pushMessage: (msg: string) => Promise<void> | void;
    updateMainThread: (threadId: string) => void;
    setLoading?: (loading: boolean) => void;
}

export function useCharacterCreation(deps: CharacterCreationDeps) {
    const { startStream } = useAssistantStream();
    // AddCharacter required shape (from generated reducer type) – keep initial defaults minimal
    const requiredFields: string[] = [
        'name', 'description', 'race', 'archetype', 'profession', 'startingRegion',
        'strength', 'dexterity', 'intelligence', 'constitution', 'wisdom', 'charisma',
        'maxHealth', 'currentHealth', 'maxMana', 'currentMana', 'raceAbilities', 'professionAbilities', 'level', 'xp', 'equippedWeapon'
    ];
    const emptyCharacter: Record<string, any> = Object.fromEntries(requiredFields.map(f => [f, (typeof f === 'string' && f.match(/health|mana|strength|dexterity|intelligence|constitution|wisdom|charisma|level|xp/) ? 0 : '')]));
    // Provide sensible numeric baselines
    Object.assign(emptyCharacter, {
        strength: 1, dexterity: 1, intelligence: 1, constitution: 1, wisdom: 1, charisma: 1,
        maxHealth: 10, currentHealth: 10, maxMana: 5, currentMana: 5, level: 1, xp: 0
    });

    function normalizeAssistantCharacter(partial: any): Record<string, any> {
        const out: Record<string, any> = {};
        if (!partial) return out;
        for (const key of requiredFields) {
            if (!Object.prototype.hasOwnProperty.call(partial, key)) continue;
            let val = partial[key];
            if (typeof val === 'string') {
                const trimmed = val.trim();
                if (trimmed !== '' && !isNaN(Number(trimmed)) && ['strength', 'dexterity', 'intelligence', 'constitution', 'wisdom', 'charisma', 'maxHealth', 'currentHealth', 'maxMana', 'currentMana', 'level', 'xp'].includes(key)) {
                    val = Number(trimmed);
                } else {
                    val = trimmed;
                }
            }
            out[key] = val;
        }
        return out;
    }

    function getMissingFields(character: Record<string, any>): string[] {
        const missing: string[] = [];
        for (const key of requiredFields) {
            const v = character[key];
            if (v === null || v === undefined) { missing.push(key); continue; }
            if (typeof v === 'string' && v.trim() === '') { missing.push(key); continue; }
            if (typeof v === 'number' && isNaN(v)) { missing.push(key); continue; }
        }
        return missing;
    }

    function isComplete(character: Record<string, any>): boolean {
        return getMissingFields(character).length === 0;
    }
    // characterStore.currentCharacter will be the single source of truth

    async function ensureStarterRegion(rawName: string): Promise<string | null> {
        if (!rawName) return null;
        // Already an id?
        const byId = deps.regionStore.findRegionById?.(rawName);
        if (byId) return byId.regionId;
        const existing = deps.regionStore.findRegionByName?.(rawName);
        if (existing) return existing.regionId;
        const candidateName = rawName.trim();
        // Invoke Region Creation Resolver assistant for structured region suggestion
        let regionPlan: any = null;
        try {
            deps.setLoading?.(true);
            const ctx = { character: { ...(deps.characterStore.currentCharacter || {}) }, existingRegions: Array.from(deps.regionStore.regions?.values?.() || []) };
            const response = await fetch('/assistant/run', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'region.create', message: `Create a starter region named ${candidateName}`, context: ctx })
            });
            if (response.ok) {
                const data = await response.json();
                // Attempt to parse last output part as JSON (same pattern as other handlers)
                const last = data.output[data.output.length - 1] || '{}';
                try { regionPlan = JSON.parse(last); } catch { /* ignore */ }
                if (!regionPlan) {
                    // Try substring extraction fallback
                    const firstBrace = last.indexOf('{');
                    const lastBrace = last.lastIndexOf('}');
                    if (firstBrace !== -1 && lastBrace > firstBrace) {
                        const candidate = last.slice(firstBrace, lastBrace + 1).trim();
                        try { regionPlan = JSON.parse(candidate); } catch { /* ignore */ }
                    }
                }
            } else {
                console.warn('Region creation assistant non-OK status', response.status);
            }
        } catch (e) {
            console.error('Region creation assistant request failed', e);
        } finally {
            deps.setLoading?.(false);
        }

        // Expected shape: { actions: { createRegion: { name, id?, description, climate, resources, tier, connectedRegions? } }, narrative? }
        let createRegionAction = regionPlan?.actions?.createRegion;
        if (!createRegionAction) {
            // Fallback minimal stub if assistant failed
            createRegionAction = {
                name: candidateName,
                description: `${candidateName} – an uncharted origin.`,
                climate: 'temperate',
                resources: ['herbs'],
                tier: 1,
                connectedRegions: []
            };
        }
        // Decide starter vs linked creation; for initial character we use starter (no fromRegion)
        const starterPayload = {
            name: createRegionAction.name || candidateName,
            description: createRegionAction.description || `${candidateName} – nascent refuge`,
            fullDescription: createRegionAction.description || `${candidateName} – nascent refuge`, // assistant separate narrative may be integrated later
            climate: createRegionAction.climate || 'temperate',
            culture: createRegionAction.culture || 'frontier',
            resources: Array.isArray(createRegionAction.resources) ? createRegionAction.resources : ['herbs']
        };
        try { deps.regionStore.createStarterRegion?.(starterPayload); } catch (e) { console.error('Failed createStarterRegion via assistant data', e); return null; }
        // Wait for insertion
        const start = Date.now();
        return await new Promise(resolve => {
            const interval = setInterval(() => {
                const found = deps.regionStore.findRegionByName?.(starterPayload.name);
                if (found) { clearInterval(interval); resolve(found.regionId); }
                else if (Date.now() - start > 10000) { clearInterval(interval); resolve(null); }
            }, 250);
        });
    }

    async function handleCharacterCreationLoopStreaming(initialMessage: string, getNextUserInput: () => Promise<string>) {
        let currentMessage = initialMessage;
        let iteration = 0;
        let threadId: string | null = null;

        while (!deps.characterStore.currentCharacter?.characterId) {
            // Initialize working character in store if absent
            if (!deps.characterStore.currentCharacter) {
                deps.characterStore.currentCharacter = { ...emptyCharacter };
            }
            const working = deps.characterStore.currentCharacter;
            const missingBefore = getMissingFields(working);
            if (iteration === 0) {
                emitPhase('CONCEPT', deps.mainStore.currentUserId || null, { iteration, missing: missingBefore });
            } else {
                emitPhase('REFINEMENT', deps.mainStore.currentUserId || null, { iteration, missing: missingBefore });
            }

            let finalJson: any = null;
            let receivedChunk = false;

            // Provide current progress & missing fields to assistant (regionProgress included)
            const context = { ...deps.buildContext(), characterProgress: { ...working }, regionProgress: { ...(deps.regionStore.currentRegion || {}) }, missingFields: missingBefore };

            deps.setLoading?.(true);
            await startStream({
                message: currentMessage,
                action: 'character.create',
                threadId: threadId,
                context,
                onMeta: (m) => { threadId = m.threadId; },
                onChunk: async (text) => {
                    receivedChunk = true;
                    // Stream chunks are treated as narrative only; defer structured parse to onResult
                    await deps.pushMessage(`🧙 ${text}`);
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
                        const normalized = normalizeAssistantCharacter(finalJson.actions.createCharacter);
                        Object.assign(working, normalized);
                    }
                },
                onDone: async () => { deps.setLoading?.(false); },
                onError: async (err) => {
                    if (err === 'aborted') return;
                    console.error('Character creation stream error:', err);
                    await deps.pushMessage('❌ Character creation stream failed. Retrying with non-stream endpoint...');
                    emitPhase('ERROR', deps.mainStore.currentUserId || null, { reason: 'character_creation_stream_failed' });
                    deps.setLoading?.(false);
                }
            });

            // At this point, check if we have a starter region name and it hasn't been created yet (not a UUID)
            if (working.startingRegion && typeof working.startingRegion === 'string' && working.startingRegion.length < 40) {
                const regionId = await ensureStarterRegion(working.startingRegion);
                if (regionId) {
                    working.startingRegion = regionId;
                    const regionObj = deps.regionStore.findRegionById?.(regionId);
                    if (regionObj) deps.regionStore.setCurrentRegion?.(regionObj);
                }
            }

            const missing = getMissingFields(working);
            if (missing.length === 0) {
                emitPhase('CONFIRMATION', deps.mainStore.currentUserId || null, { character: { ...working }, region: deps.regionStore.currentRegion || null });
                await deps.characterStore.addCharacter(working);
                const charId = (working as any).characterId || null;
                emitPhase('PERSISTENCE', deps.mainStore.currentUserId || null, { characterId: charId, startingRegion: working.startingRegion });
                if (threadId) deps.updateMainThread(threadId);
                deps.setLoading?.(false);
                break;
            }

            // Fallback if stream produced no chunks/result
            if (!receivedChunk && !finalJson) {
                if (import.meta.env.DEV) console.debug('[characterCreation] no stream chunks; invoking /assistant/run fallback');
                try {
                    deps.setLoading?.(true);
                    const response = await fetch('/assistant/run', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ action: 'character.create', message: currentMessage, threadId, context })
                    });
                    if (response.ok) {
                        const data = await response.json();
                        const last = data.output[data.output.length - 1] || '{}';
                        let parsed: any; try { parsed = JSON.parse(last); } catch { parsed = { narrative: last }; }
                        if (parsed.narrative) await deps.pushMessage(`🧙 ${parsed.narrative}`);
                        finalJson = parsed;
                        if (finalJson.actions?.createCharacter) {
                            const normalized = normalizeAssistantCharacter(finalJson.actions.createCharacter);
                            Object.assign(working, normalized);
                        }
                    } else {
                        if (import.meta.env.DEV) console.error('[characterCreation] fallback /assistant/run non-OK', response.status);
                        await deps.pushMessage('❌ Character creation fallback failed.');
                    }
                } catch (e) {
                    console.error('Character creation fallback error', e);
                    await deps.pushMessage('❌ Character creation fallback error.');
                } finally { deps.setLoading?.(false); }
            }

            if (deps.characterStore.currentCharacter?.characterId) break;
            currentMessage = await getNextUserInput();
            await deps.pushMessage(`🗨️ You: ${currentMessage}`);
            iteration++;
        }
    }

    return { handleCharacterCreationLoopStreaming };
}
