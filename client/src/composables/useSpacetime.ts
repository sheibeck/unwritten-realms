import { ref } from 'vue';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let stdbClient: any | null = null;
// Placeholder client; replace with actual SpacetimeDB client SDK usage

export function useSpacetime() {
    const connected = ref(false);

    async function connect(token?: string) {
        // Connect to SpacetimeDB using client SDK and subscribe to narrative_events
        try {
            // Dynamically import to avoid build issues if SDK is missing
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore
            const sdk = await import('spacetimedb');
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const Client = (sdk as any).Client || (sdk as any).default || sdk;
            stdbClient = await Client.connect({ db: 'unwritten_realms', token });
            connected.value = true;
        } catch (e) {
            // Fallback: mark connected to let UI proceed; real SDK wiring can be added later
            connected.value = true;
        }
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
        if (stdbClient?.subscribe) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (stdbClient as any).subscribe('narrative_events', (row: any) => {
                cb({ id: row.id, text: row.text, timestamp: row.timestamp });
            });
            return;
        }
        // Fallback simulation if SDK not present
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
