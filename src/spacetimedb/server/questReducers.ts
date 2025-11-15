import { t } from 'spacetimedb/server';
import { spacetimedb } from './schema';
import { uuidv4 } from './uuid';

export function registerQuestReducers() {
    spacetimedb.reducer('add_quest', {
        npcId: t.string(),
        name: t.string(),
        description: t.string(),
        steps: t.i32(),
        reward: t.string(),
        penalty: t.string(),
        type: t.string(),
        repeatable: t.bool(),
    }, (ctx, input) => {
        const npcExists = Array.from(ctx.db.npc.iter()).some((n: any) => n.npcId === input.npcId);
        if (!npcExists) {
            console.warn(`add_quest: NPC not found for npcId=${input.npcId}`);
            return;
        }
        ctx.db.quest.insert({
            questId: uuidv4(),
            ...input,
        });
    });
}
