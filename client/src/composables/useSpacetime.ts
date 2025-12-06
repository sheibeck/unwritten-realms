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

    async function connect(token?: string) {
        const uri = import.meta.env.VITE_SPACETIMEDB_URL ?? 'http://localhost:3000';
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
            .withModuleName('unwrittenrealms')
            .withToken(token)
            .onConnect((_ctx: any, _identity: Identity) => {

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


    return { connected, connect };
}
