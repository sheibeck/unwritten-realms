import { ref } from 'vue';
// Placeholder client; replace with actual SpacetimeDB client SDK usage

export function useSpacetime() {
    const connected = ref(false);

    async function connect() {
        // TODO: Connect to SpacetimeDB and subscribe to narrative_events
        connected.value = true;
    }

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

    return { connected, connect, onNarrativeEvent, applyIntent };
}
