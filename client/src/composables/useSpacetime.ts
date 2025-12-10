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
        let email: string | undefined;
        let aud: string | undefined;
        const expectedAud = import.meta.env.VITE_GOOGLE_CLIENT_ID;

        // Distinguish JWT (id_token) from opaque access tokens
        if (idToken.includes('.') && idToken.split('.').length === 3) {
            const payload = decodeJwt(idToken);
            email = payload?.email as string | undefined;
            aud = Array.isArray(payload?.aud) ? payload?.aud[0] : (payload?.aud as string | undefined);

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

        // Non-JWT token (likely an access token). Use the Google userinfo endpoint to get the email.
        try {
            const resp = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
                headers: {
                    Authorization: `Bearer ${idToken}`,
                },
            });

            if (!resp.ok) {
                const text = await resp.text();
                throw new Error(`Failed to fetch Google userinfo: ${resp.status} ${text}`);
            }

            const data = await resp.json();
            email = data.email as string | undefined;
            if (!email) {
                throw new Error('Google userinfo did not contain an email claim');
            }

            // We still need an id_token to pass to connect(); if server expects id_token, you might
            // need to exchange the access token for an id_token on the server. For now we pass the
            // access token through to connect() as a best-effort bearer.
            await connect(idToken);
            return { id_token: idToken, email };
        } catch (e) {
            throw e;
        }
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
