// Local command resolution & payload builder using canonical actions.

export function useLocalActions(characterStore: any) {
    function resolveLocalAction(message: string, isOverride = false): string {
        const lower = message.toLowerCase();
        if (lower === 'look') return 'look';
        if (isOverride && lower.includes('traveling from')) return 'travel.move';
        if (isOverride && lower.includes('exploring from')) return 'region.create';
        if (lower === 'awaken' && !characterStore.currentCharacter) return 'character.create';
        return 'world.general';
    }

    function buildPayload(action: string, messageContent: string, additionalData: Record<string, any> = {}): Record<string, any> {
        return {
            action,
            message: messageContent,
            characterId: characterStore.currentCharacter?.characterId ?? null,
            context: additionalData
        };
    }

    return { resolveLocalAction, buildPayload };
}
