import { t } from 'spacetimedb/server';
import { spacetimedb } from './schema';
import { uuidv4 } from './uuid';

export function registerNpcReducers() {
    spacetimedb.reducer('create_npc', {
        name: t.string(),
        description: t.string(),
        race: t.string(),
        profession: t.string(),
        maxHealth: t.i32(),
        currentHealth: t.i32(),
        maxMana: t.i32(),
        currentMana: t.i32(),
        abilities: t.string(),
        regionId: t.string(),
    }, (ctx, input) => {
        ctx.db.npc.insert({
            npcId: uuidv4(),
            ...input,
        });
    });
}
