import { t } from 'spacetimedb/server';
import { spacetimedb } from './schema';

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
        ctx.db.quest.insert({
            questId: crypto.randomUUID(),
            ...input,
        });
    });
}
