import { schema, table, t, SenderError } from "spacetimedb/server";
import { handleIntent } from './intent-handler';

// Helper to authorize by email
function requireEmail(ctx: any, requiredEmail: string): any {
    if (!ctx.sender) throw new SenderError('Unauthenticated');

    let user: any = null;
    for (const u of ctx.db.users.id.filter(ctx.sender)) {
        user = u;
        break;
    }

    if (!user) throw new SenderError('User not found');
    if (user.email !== requiredEmail) throw new SenderError('Email mismatch: unauthorized');

    return user;
}

// Helper to get current user
function getCurrentUser(ctx: any): any {
    if (!ctx.sender) throw new SenderError('Unauthenticated');

    let user: any = null;
    for (const u of ctx.db.users.id.filter(ctx.sender)) {
        user = u;
        break;
    }

    if (!user) throw new SenderError('User not found');
    return user;
}

export const spacetimedb = schema(
    // Auth users table per Google OAuth -> SpacetimeDB identity flow
    table(
        {
            name: "users", public: true,
            indexes: [
                { name: 'byProviderSub', algorithm: 'btree', columns: ['provider_sub'] }
            ]
        },
        {
            id: t.identity(),
            provider: t.string(),
            provider_sub: t.string(),
            email: t.string().unique(),
            created_at: t.number()
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
            account_id: t.identity(),
            device_id: t.string(),
            last_seen: t.number()
        }
    ),
    table(
        { name: "narrative_events", public: true },
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
// ensure_user: inserts or fetches a user based on email
spacetimedb.reducer(
    'ensure_user',
    { provider: t.string(), provider_sub: t.string(), email: t.string() },
    (ctx, { provider, provider_sub, email }) => {
        const identity = ctx.sender;
        if (!identity) throw new SenderError('Unauthenticated');
        if (!email) throw new SenderError('Email is required');

        // Look up user by email (unique accessor)
        const existing = ctx.db.users.email.find(email);

        if (!existing) {
            // Create new user
            const newUser = {
                id: identity,
                provider,
                provider_sub,
                email,
                created_at: Date.now(),
            };
            ctx.db.users.insert(newUser);
        }
    }
);

// OIDC configuration for local auth (modules cannot read process.env)
// Adjust these literals during development/publish as needed.
const OIDC_CLIENT_IDS = ["client_local_dev"]; // comma-separated client IDs not supported inside module
const OIDC_ISSUER = "http://localhost:8081/oidc";

spacetimedb.clientConnected((ctx) => {
    const jwt = ctx.senderAuth.jwt;
    if (jwt == null) {
        throw new SenderError("Unauthorized: JWT is required to connect");
    }
    console.info(`Client connected with sub: ${jwt.subject}, iss: ${jwt.issuer}`);
});

// Auth: login with Google ID token
spacetimedb.reducer('login_with_google_id', { device_id: t.option(t.string()), email: t.string() }, (ctx, { device_id, email }) => {
    // Prefer the documented senderAuth.jwt helpers (subject/issuer/aud)
    const jwt = ctx.senderAuth.jwt;

    if (jwt == null) {
        throw new SenderError("Unauthorized: JWT is required to connect");
    }
    if (!email) {
        throw new SenderError("Email is required");
    }
    if (jwt?.issuer != OIDC_ISSUER) {
        throw new SenderError(`Unauthorized: Invalid issuer ${jwt?.issuer}`);
    }
    if (!jwt?.audience.some((aud) => OIDC_CLIENT_IDS.includes(aud))) {
        throw new SenderError(`Unauthorized: Invalid audience ${jwt?.audience}`);
    }

    // Look up user by email (unique accessor)
    const userId = ctx.sender;
    const foundUser = ctx.db.users.email.find(email);
    if (!foundUser) {
        const subject = jwt.subject;
        ctx.db.users.insert({ id: userId, provider: 'google', provider_sub: subject, email, created_at: Date.now() });
    }

    // create session (module-local; no external crypto/Buffer usage)
    ctx.db.sessions.insert({ account_id: userId, device_id: device_id ?? 'unknown', last_seen: Date.now() });
    console.log(`login_with_google_id: ${email} -> ${userId}`);
    // reducers don't return values
});

// Auth: logout
spacetimedb.reducer('logout', (ctx) => {
    // Event-driven: write a logout marker by inserting a new session heartbeat
    ctx.db.sessions.insert({ account_id: ctx.sender, device_id: 'unknown', last_seen: Date.now() });
    console.log(`logout: ${String(ctx.sender)}`);
});

spacetimedb.reducer('apply_intent', { intent_json: t.string() }, (ctx, { intent_json }) => {
    // Ensure user is authenticated and has valid email
    const user = getCurrentUser(ctx);
    if (!user.email) {
        throw new SenderError('User email not verified');
    }

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

    // Use camelCase table accessor generated by SpacetimeDB
    ctx.db.narrative_events.insert(event);
    console.log(`apply_intent: ${event.text} by ${user.email}`);
});

spacetimedb.reducer('tick', (ctx) => {
    // TODO: World tick logic (AI, combat resolution, NPC actions)
    console.log('tick: world updated');
});
