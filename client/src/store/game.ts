import { defineStore } from 'pinia';

export const useGameStore = defineStore('game', {
    state: () => ({
        narrative_events: [] as Array<{ id: string; text: string; timestamp: number }>,
        loading: false,
        error: '' as string | null,
    }),
    actions: {
        addEvent(evt: { id: string; text: string; timestamp: number }) {
            this.narrative_events.unshift(evt);
        }
    }
});
