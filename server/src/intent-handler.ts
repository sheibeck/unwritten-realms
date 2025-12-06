type Intent = {
    kind: "move" | "combat_action" | "dialogue" | "quest_action" | "system_event";
    payload?: any;
    characterId?: string;
};

export function handleIntent(intent: Intent) {
    switch (intent.kind) {
        case "move":
            return { narrativeText: `You move to ${intent.payload?.direction}.`, characterId: intent.characterId };
        case "combat_action":
            return { narrativeText: `You strike the foe with ${intent.payload?.ability}.`, characterId: intent.characterId };
        case "dialogue":
            return { narrativeText: `You say: ${intent.payload?.text}`, characterId: intent.characterId };
        case "quest_action":
            return { narrativeText: `Quest action: ${intent.payload?.action}.`, characterId: intent.characterId };
        case "system_event":
            return { narrativeText: `System event occurred.`, characterId: intent.characterId };
        default:
            return { narrativeText: "Unknown intent.", characterId: intent.characterId };
    }
}
