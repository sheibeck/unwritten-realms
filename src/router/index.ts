// router/index.ts
import { createRouter, createWebHistory } from 'vue-router'
import SignIn from '../views/Signin.vue';
import Home from '../views/Home.vue';

const routes = [
  { path: '/signin', component: SignIn },
  { path: '/', component: Home }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

export default router
