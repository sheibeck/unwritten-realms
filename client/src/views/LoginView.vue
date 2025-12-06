<template>
  <div class="container">
    <h2>Login</h2>
    <p>Enter Google ID token (from Google OAuth) to login.</p>
    <form @submit.prevent="login">
      <input v-model="idToken" placeholder="Google ID token (stub)" />
      <button type="submit">Login</button>
    </form>
    <p v-if="error" class="error">{{ error }}</p>
  </div>
</template>
<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { useSessionStore } from '../store/session';
import { useSpacetime } from '../composables/useSpacetime';

const router = useRouter();
const session = useSessionStore();
const { loginWithGoogle, connect } = useSpacetime();

const idToken = ref('');
const error = ref('');

async function login() {
  error.value = '';
  if (!idToken.value.trim()) { error.value = 'Provide token'; return; }
  try {
    const token = await loginWithGoogle(idToken.value);
    session.setSessionToken(token);
    await connect(token);
    router.push({ name: 'game' });
  } catch (e: any) {
    error.value = e.message || 'Login failed';
  }
}
</script>
<style scoped>
.container { max-width: 600px; margin: 0 auto; padding: 24px; }
.error { color: #c00; }
input { width: 100%; padding: 8px; margin-bottom: 8px; }
</style>