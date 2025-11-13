import { spacetimedb } from './schema';

export function registerLifecycleHooks() {
    spacetimedb.init(_ctx => { });
    spacetimedb.clientConnected(ctx => {
        const user = ctx.db.user.identity.find(ctx.sender);
        if (user) {
            ctx.db.user.identity.update({ ...user, online: true });
        } else {
            ctx.db.user.insert({ identity: ctx.sender, name: undefined, online: true });
        }
    });
    spacetimedb.clientDisconnected(ctx => {
        const user = ctx.db.user.identity.find(ctx.sender);
        if (user) {
            ctx.db.user.identity.update({ ...user, online: false });
        } else {
            // Shouldn't happen (disconnect without prior connect)
            console.warn(`Disconnect event for unknown user with identity ${ctx.sender}`);
        }
    });
}
