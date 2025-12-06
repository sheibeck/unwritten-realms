import { createRouter, createWebHistory } from 'vue-router';
import GameView from '../views/GameView.vue';
import LoginView from '../views/LoginView.vue';

const routes = [
    { path: '/', name: 'game', component: GameView },
    { path: '/login', name: 'login', component: LoginView }
];

const router = createRouter({
    history: createWebHistory(),
    routes
});

export default router;
