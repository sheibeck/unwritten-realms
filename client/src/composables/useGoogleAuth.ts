// useGoogleAuth.ts (simplified)
import { ref } from 'vue';

export function useGoogleAuth() {
    const error = ref<string | null>(null);

    /**
     * Minimal wrapper around Google's initTokenClient.
     * Returns a Promise resolving to the id_token, or rejects on error.
     */
    function getGoogleIdToken(): Promise<string> {
        return new Promise((resolve, reject) => {
            try {
                const g = (window as any).google;
                if (!g || !g.accounts || !g.accounts.id) {
                    const msg = 'Google Identity Services ID client not available (window.google.accounts.id)';
                    error.value = msg;
                    reject(new Error(msg));
                    return;
                }

                // Initialize the ID client with a callback that returns a JWT in `credential`.
                g.accounts.id.initialize({
                    client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID,
                    callback: (resp: any) => {
                        if (!resp || !resp.credential) {
                            const msg = 'Google returned no credential (id token)';
                            error.value = msg;
                            reject(new Error(msg));
                            return;
                        }
                        resolve(resp.credential);
                    },
                    ux_mode: 'popup',
                });

                // Prompt will show the popup/one-tap. Must be called from a user gesture.
                g.accounts.id.prompt();
            } catch (e: any) {
                error.value = e?.message || String(e);
                reject(e);
            }
        });
    }

    function signOut() {
        try {
            // @ts-ignore
            (window as any).google.accounts.oauth2.revoke(import.meta.env.VITE_GOOGLE_CLIENT_ID, () => {
                console.log('Google OAuth permissions revoked.');
            });
        } catch (e) {
            console.warn('signOut: google API not available', e);
        }
    }

    return { getGoogleIdToken, signOut, error };
}
