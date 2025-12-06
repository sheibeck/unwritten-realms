import { ref } from 'vue';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const google: any;

export function useGoogleAuth() {
    const isLoading = ref(false);
    const error = ref('');

    function initializeGoogleSignIn(onSuccess: (credential: string) => void) {
        if (!google?.accounts?.id) {
            error.value = 'Google Identity Services not loaded';
            return;
        }

        const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
        if (!clientId) {
            error.value = 'VITE_GOOGLE_CLIENT_ID not configured in .env';
            return;
        }

        google.accounts.id.initialize({
            client_id: clientId,
            // Request email in the ID token
            // Google Identity Services One Tap uses "auto" scope; adding "email" ensures claim inclusion
            // See https://developers.google.com/identity/gsi/web/guides/overview
            // Note: for button-based OAuth flows, ensure your server requests openid email profile as well
            scope: 'openid email profile',
            callback: (response: { credential: string }) => {
                onSuccess(response.credential);
            },
            error_callback: () => {
                error.value = 'Google Sign-In failed';
            }
        });
    }

    function renderSignInButton(elementId: string) {
        if (!google?.accounts?.id) {
            error.value = 'Google Identity Services not loaded';
            return;
        }

        google.accounts.id.renderButton(
            document.getElementById(elementId),
            {
                type: 'standard',
                size: 'large',
                text: 'signin',
                locale: 'en'
            }
        );
    }

    function renderOneTapUI() {
        if (!google?.accounts?.id) {
            error.value = 'Google Identity Services not loaded';
            return;
        }

        google.accounts.id.prompt((notification: any) => {
            if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
                // One Tap UI was not displayed or was skipped; fall back to button
            }
        });
    }

    /**
     * Disable Google's auto-sign-in and revoke the current session so the user
     * can fully log off and switch accounts on the next login.
     */
    async function logoffGoogle(emailHint?: string) {
        if (!google?.accounts?.id) {
            error.value = 'Google Identity Services not loaded';
            return;
        }

        // Prevent automatic re-selection of the previous account.
        google.accounts.id.disableAutoSelect();

        if (emailHint) {
            // Wrap revoke callback in a promise so callers can await completion.
            await new Promise<void>((resolve) => {
                google.accounts.id.revoke(emailHint, () => resolve());
            });
        }
    }

    return {
        isLoading,
        error,
        initializeGoogleSignIn,
        renderSignInButton,
        renderOneTapUI,
        logoffGoogle
    };
}
