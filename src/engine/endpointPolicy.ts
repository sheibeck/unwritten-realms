// Endpoint selection policy for assistant interactions
// Decide whether to stream based on action semantic category


const STREAM_ACTIONS = new Set([
    'character.create',
    'character.level_up',
    'region.create',
    'travel.move',
    'world.event',
    'world.general',
    'combat.encounter.resolve',
    'renown.manage',
    'quest.create',
    'quest.generate',
    'npc.dialogue.open',
    'npc.dialogue.respond',
    'region.describe',
    'region.zone.describe'
]);

export function shouldStream(action: string): boolean {
    return STREAM_ACTIONS.has(action);
}
