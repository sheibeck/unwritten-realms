import { createRouter, createWebHistory } from 'vue-router';
import GameView from '../views/GameView.vue';
import LoginView from '../views/LoginView.vue';
import { useAuthStore } from '../store/auth';

const routes = [
    { path: '/', name: 'game', component: GameView, meta: { requiresAuth: true } },
    { path: '/login', name: 'login', component: LoginView }
];

const router = createRouter({
    history: createWebHistory(),
    routes
});

// Auth guard: redirect to login if not authenticated
router.beforeEach((to, from, next) => {
    const authStore = useAuthStore();

    if (to.meta.requiresAuth && !authStore.isAuthenticated) {
        // Redirect to login if route requires auth and user is not authenticated
        next({ name: 'login' });
    } else if (to.name === 'login' && authStore.isAuthenticated) {
        // Redirect to game if already logged in and trying to visit login
        next({ name: 'game' });
    } else {
        next();
    }
});

export default router;
