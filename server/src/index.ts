import { schema, table, t } from "spacetimedb/server";
import { handleIntent } from './intent-handler';

export const spacetimedb = schema(
    table(
        { name: "users" },
        {
            id: t.string(),
            google_id: t.string(),
            last_login: t.number()
        }
    ),
    table(
        { name: "characters" },
        {
            id: t.string(),
            owner_id: t.string(),
            class: t.string(),
            stats_json: t.string()
        }
    ),
    table(
        { name: "sessions" },
        {
            account_id: t.string(),
            device_id: t.string(),
            last_seen: t.number()
        }
    ),
    table(
        { name: "narrative_events" },
        {
            id: t.string(),
            character_id: t.string(),
            text: t.string(),
            intent_json: t.string(),
            timestamp: t.number()
        }
    )
);

// lifecycle reducers
spacetimedb.reducer("init", (_ctx) => {
    // Called when the module is initially published
});

spacetimedb.reducer("client_connected", (_ctx) => {
    // Called every time a new client connects
});

spacetimedb.reducer("client_disconnected", (_ctx) => {
    // Called every time a client disconnects
});

// Application reducers
spacetimedb.reducer('login_with_google', { google_id: t.string() }, (ctx, { google_id }) => {
    // TODO: Implement real Google OAuth. For now create/stub a user row.
    const userId = `user_${google_id}`;
    const users = ctx.db.users;
    let found = null;
    for (const u of users.iter()) {
        if (u.google_id === google_id) {
            found = u;
            break;
        }
    }

    users.insert({ id: userId, google_id, last_login: Date.now() });

    console.log(`login_with_google: ${google_id} -> ${userId}`);
});

spacetimedb.reducer('apply_intent', { intent_json: t.string() }, (ctx, { intent_json }) => {
    let parsed: any = null;
    try {
        parsed = JSON.parse(intent_json);
    } catch (e) {
        console.log('apply_intent: invalid JSON');
        return;
    }
    const result = handleIntent(parsed);
    const event = {
        id: `${Date.now()}`,
        character_id: result.characterId ?? 'unknown',
        text: result.narrativeText,
        intent_json,
        timestamp: Date.now()
    };

    ctx.db.narrativeEvents.insert(event);
    console.log(`apply_intent: ${event.text}`);
});

spacetimedb.reducer('tick', (ctx) => {
    // TODO: World tick logic (AI, combat resolution, NPC actions)
    console.log('tick: world updated');
});
