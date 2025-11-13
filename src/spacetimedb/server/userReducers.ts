import { t, SenderError } from 'spacetimedb/server';
import { spacetimedb } from './schema';

function validateName(name: string) {
    if (!name) throw new SenderError('Names must not be empty');
}

export function registerUserReducers() {
    spacetimedb.reducer('set_name', { name: t.string() }, (ctx, { name }) => {
        validateName(name);
        const user = ctx.db.user.identity.find(ctx.sender);
        if (!user) throw new SenderError('Cannot set name for unknown user');
        ctx.db.user.identity.update({ ...user, name });
    });
    spacetimedb.reducer('clear_users', ctx => {
        for (const user of ctx.db.user.iter()) {
            ctx.db.user.identity.delete(user.identity);
        }
    });
}
