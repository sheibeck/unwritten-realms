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
        ctx.db.quest.insert({
            questId: uuidv4(),
            ...input,
        });
    });
}
