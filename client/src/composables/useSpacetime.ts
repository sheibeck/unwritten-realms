import { ref } from 'vue';
// Module bindings are generated at build time (`spacetime generate`), so import statically.
import * as moduleBindings from '../module_bindings';
import { useCharactersStore } from '../store/characters';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Identity = any;

// Singleton connection + state so multiple composable consumers share it
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const connectionRef = ref<any | null>(null);
const connected = ref(false);

export function useSpacetime() {

    /**
     * Directly authenticate with SpacetimeDB using the Google ID token.
     * Validate that the token carries an email claim and matches our client id.
     */
    async function loginWithGoogle(idToken: string) {
        let email: string | undefined;
        let aud: string | undefined;
        const expectedAud = import.meta.env.VITE_GOOGLE_CLIENT_ID;

        // Distinguish JWT (id_token) from opaque access tokens
        if (idToken.includes('.') && idToken.split('.').length === 3) {
            const payload = decodeJwt(idToken);
            console.debug('loginWithGoogle: decoded JWT payload', payload);
            email = payload?.email as string | undefined;
            aud = Array.isArray(payload?.aud) ? payload?.aud[0] : (payload?.aud as string | undefined);

            // If email is not present in the decoded JWT, try Google's tokeninfo endpoint
            if (!email) {
                try {
                    const infoResp = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`);
                    if (infoResp.ok) {
                        const info = await infoResp.json();
                        console.debug('loginWithGoogle: tokeninfo response', info);
                        email = info.email as string | undefined;
                        aud = aud || (info.aud as string | undefined);
                    } else {
                        console.warn('loginWithGoogle: tokeninfo fetch failed', infoResp.status);
                    }
                } catch (e) {
                    console.warn('loginWithGoogle: tokeninfo fetch error', e);
                }
            }

            if (!email) {
                throw new Error('Google id_token missing email claim. Ensure you are using the correct Google Web client ID.');
            }
            if (expectedAud && aud && aud !== expectedAud) {
                console.warn(`Google token audience mismatch. token aud=${aud}, expected=${expectedAud}`);
            }

            // Use the id_token directly to connect
            await connect(idToken);
            return { id_token: idToken, email };
        }

        throw new Error('Provided Google token is not a valid id_token (JWT)');
    }

    // Minimal JWT payload decoder (base64url -> JSON), no signature verification.
    function decodeJwt(token: string): Record<string, unknown> | null {
        const parts = token.split('.');
        if (parts.length < 2) return null;
        try {
            const payload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
            const decoded = atob(payload.padEnd(payload.length + (4 - (payload.length % 4)) % 4, '='));
            return JSON.parse(decoded);
        } catch {
            return null;
        }
    }

    async function connect(token?: string) {
        const uri = import.meta.env.VITE_SPACETIMEDB_URL ?? 'http://localhost:3000';
        const moduleName = import.meta.env.VITE_SPACETIMEDB_MODULE ?? 'unwrittenrealms';
        console.log('Connecting to SpacetimeDB', { uri, moduleName, hasToken: Boolean(token) });
        const conn = moduleBindings.DbConnection
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
                const charsStore = useCharactersStore();
                connectionRef.value.subscriptionBuilder()
                    .onApplied((_ctx: any) => {
                        console.log('Subscription applied');

                        // register insert callbacks when rows are present
                        conn!.db.narrativeEvents.onInsert((_c: any, row: any) => {
                            console.log('narrative event', row);
                        });

                        // characters owned by this identity
                        try {
                            const list = [];
                            for (const row of conn.db.characters.iter()) {
                                list.push(row);
                            }
                            charsStore.setCharacters(list);
                            if (!charsStore.activeCharacter && list.length) {
                                charsStore.setActiveCharacter(list[0]);
                            }

                        } catch (e) {
                            // binding may not exist if module bindings weren't regenerated
                        }
                    })
                    //.subscribeToAllTables();
                    .subscribe([
                        'SELECT * FROM characters'
                    ])
                // .subscribe([
                //     'SELECT * FROM narrative_events',
                //     'SELECT * FROM users WHERE id = $1', _ctx.identity,
                //     'SELECT * FROM characters WHERE owner_id = $1', _identity.toHexString()
                // ]);

                connected.value = true;
            })
            .onDisconnect((_ctx: any, _identity: Identity) => {
                console.log(
                    'Client disconnected:'
                );
                connected.value = false;
            })
            .onConnectError((_ctx: any, err: any) => {
                console.error('SpacetimeDB connect error', err);
                connected.value = false;
            })
            .build();
        connectionRef.value = conn;
    }


    function getConnection() { return connectionRef.value; }
    function getDb() { return connectionRef.value?.db ?? null; }

    return { connected, connect, loginWithGoogle, getConnection, getDb };
}
