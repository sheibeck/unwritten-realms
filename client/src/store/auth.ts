import { defineStore } from 'pinia';
import { ref } from 'vue';

export interface User {
    id: string;
    email: string;
    provider: string;
    provider_sub: string;
    created_at: number;
}

export const useAuthStore = defineStore('auth', () => {
    const user = ref<User | null>(null);
    const token = ref<string | null>(null);
    const isAuthenticated = ref(false);

    function setAuth(newUser: User, newToken: string) {
        user.value = newUser;
        token.value = newToken;
        isAuthenticated.value = true;
        localStorage.setItem('auth_token', newToken);
        localStorage.setItem('auth_user', JSON.stringify(newUser));
    }

    function logout() {
        user.value = null;
        token.value = null;
        isAuthenticated.value = false;
        localStorage.removeItem('auth_token');
        localStorage.removeItem('auth_user');
    }

    function restoreAuth() {
        const storedToken = localStorage.getItem('auth_token');
        const storedUser = localStorage.getItem('auth_user');

        if (storedToken && storedUser) {
            try {
                user.value = JSON.parse(storedUser);
                token.value = storedToken;
                isAuthenticated.value = true;
            } catch (e) {
                logout();
            }
        }
    }

    return {
        user,
        token,
        isAuthenticated,
        setAuth,
        logout,
        restoreAuth
    };
});
