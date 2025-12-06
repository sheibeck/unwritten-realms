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

    return {
        isLoading,
        error,
        initializeGoogleSignIn,
        renderSignInButton,
        renderOneTapUI
    };
}
