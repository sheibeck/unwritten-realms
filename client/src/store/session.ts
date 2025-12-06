import { defineStore } from 'pinia';

export const useSessionStore = defineStore('session', {
    state: () => ({
        token: '' as string,
        userId: '' as string,
    }),
    actions: {
        setSessionToken(token: string, userId?: string) {
            this.token = token;
            if (userId) this.userId = userId;
        },
        clear() {
            this.token = '';
            this.userId = '';
        }
    }
});