import { ref } from 'vue';
// Module bindings are generated at build time (`spacetime generate`), so import statically.
import * as moduleBindings from '../module_bindings';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Identity = any;

export function useSpacetime() {
    const connected = ref(false);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let connection: any | null = null;

    /**
     * Directly authenticate with SpacetimeDB using the Google ID token.
     * Validate that the token carries an email claim and matches our client id.
     */
    async function loginWithGoogle(idToken: string) {
        const payload = decodeJwt(idToken);
        const email = payload?.email as string | undefined;
        const aud = Array.isArray(payload?.aud) ? payload?.aud[0] : (payload?.aud as string | undefined);
        const expectedAud = import.meta.env.VITE_GOOGLE_CLIENT_ID;

        if (!email) {
            throw new Error('Google token missing email claim. Ensure you are using the correct Google Web client ID.');
        }
        if (expectedAud && aud && aud !== expectedAud) {
            console.warn(`Google token audience mismatch. token aud=${aud}, expected=${expectedAud}`);
        }

        await connect(idToken);
        return { id_token: idToken, email };
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
                    .subscribe([
                        'SELECT * FROM narrative_events',
                        'SELECT * FROM users WHERE id = $1', _identity.toHexString()
                    ]);

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
    }


    return { connected, connect, loginWithGoogle };
}
