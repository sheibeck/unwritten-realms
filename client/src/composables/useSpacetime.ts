import { ref } from 'vue';
// Module bindings are generated via `spacetime generate`.
// We load them dynamically to avoid build errors if not present in dev.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let moduleBindings: any | null = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Identity = any;

export function useSpacetime() {
    const connected = ref(false);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let connection: any | null = null;

    /**
     * Exchange Google ID token via narrative-service and use that JWT to
     * authenticate directly with SpacetimeDB.
     */
    async function loginWithGoogle(idToken: string) {
        const narrativeServiceUrl = import.meta.env.VITE_NARRATIVE_SERVICE_URL || 'http://localhost:8081';
        const response = await fetch(`${narrativeServiceUrl}/auth/google`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ idToken })
        });
        if (!response.ok) {
            throw new Error(`Login failed: ${response.statusText}`);
        }
        const data = await response.json();
        // Automatically connect using the Google-issued id_token
        await connect(data.id_token);
        return data;
    }

    async function connect(token?: string) {
        const uri = import.meta.env.VITE_SPACETIMEDB_URL ?? 'http://localhost:3000';
        const moduleName = import.meta.env.VITE_SPACETIMEDB_MODULE ?? 'unwrittenrealms';
        if (!moduleBindings) {
            try {
                // @ts-ignore: module bindings may not exist in dev until generated
                moduleBindings = await import('../module_bindings/index');
            } catch (e) {
                console.warn('SpacetimeDB module bindings not found. Generate them via `spacetime generate`.');
                connected.value = true;
                return;
            }
        }
        connection = moduleBindings.DbConnection
            .builder()
            .withUri(uri)
            .withModuleName(moduleName)
            .withToken(token)
            .onConnect((_ctx: any, _identity: Identity) => {
                // Persist the bearer used for SpacetimeDB auth (Google id_token)
                localStorage.setItem('auth_token', token || '');
                console.log(
                    'Connected to SpacetimeDB with identity:',
                    _identity.toHexString()
                );

                // subscribe to narrative_events
                _ctx.subscriptionBuilder()
                    .onApplied((_ctx: any) => {
                        // register insert callback when rows are present
                        connection!.db.narrativeEvents.onInsert((_c: any, row: any) => {
                            // handled via onNarrativeEvent registration
                            console.log(row);
                        });
                    })
                    .subscribe('SELECT * FROM narrative_events');

                connected.value = true;
            })
            .onDisconnect((_ctx: any, _identity: Identity) => {
                console.log(
                    'Client disconnected:',
                    _identity.toHexString()
                );
            })
            .onConnectError((_ctx: any, err: any) => {
                console.error('SpacetimeDB connect error', err);
            })
            .build();
    }


    return { connected, connect, loginWithGoogle };
}
