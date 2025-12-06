import { ref } from 'vue';
// Placeholder client; replace with actual SpacetimeDB client SDK usage

export function useSpacetime() {
    const connected = ref(false);

    async function connect(token?: string) {
        // TODO: Connect to SpacetimeDB and subscribe to narrative_events
        // token will be used with real client SDK
        connected.value = true;
    }

    const loginWithGoogle = async (idToken: string) => {
        const response = await fetch('/auth/google', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ idToken }),
        });
        if (!response.ok) throw new Error('Login failed');
        const { spacetimedb_token } = await response.json();
        return spacetimedb_token as string;
    };

    function onNarrativeEvent(cb: (evt: { id: string; text: string; timestamp: number }) => void) {
        // TODO: real subscription; simulate for now
        setTimeout(() => {
            cb({ id: String(Date.now()), text: 'Welcome to Unwritten Realms!', timestamp: Date.now() });
        }, 500);
    }

    async function applyIntent(intent: unknown) {
        // TODO: call reducer via SpacetimeDB client
        console.log('applyIntent', intent);
    }

    return { connected, connect, onNarrativeEvent, applyIntent, loginWithGoogle };
}
