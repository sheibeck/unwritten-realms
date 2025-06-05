import { defineStore } from 'pinia';
import { shallowRef, ref } from 'vue';
import type { DbConnection, User } from '@/module_bindings/client';
import { useSpacetime } from '@/composable/useSpacetime';
import { getCurrentUser } from '@aws-amplify/auth';

export const useMainStore = defineStore('main', () => {
  
    const { connect, connected } = useSpacetime();
    const connection = shallowRef<DbConnection | null>(null);
    const currentUser = shallowRef<User | null>(null);
    const currentUserId = ref<string | null>();
    
    async function connectSpacetime() {
        const connectedConn = await connect();

        if (!connectedConn) {
            console.warn('Could not connect to SpaceTimeDB');
            return;
        }

        setConnection(connectedConn);
    }

    async function authenticateUser() {
        try {
            const { userId } = await getCurrentUser();
            currentUserId.value = userId;
        } catch {
            console.warn('⚠️ No Cognito user found — player must log in.');
            currentUserId.value = null;
        }
    }
            
    function setConnection(conn: DbConnection | null) {
        connection.value = conn;
    }

    function setCurrentUser(user: User | null) {
        currentUser.value = user;
    }

    return {
        connectSpacetime,
        setConnection,
        connection,
        setCurrentUser,
        currentUser,
        connected,
        authenticateUser,
        currentUserId,
    };
});
