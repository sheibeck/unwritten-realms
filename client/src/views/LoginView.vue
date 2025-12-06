<template>
  <div class="container">
    <h2>Login</h2>
    <p>Sign in with your Google account.</p>
    <div id="google-signin-button" class="button-container"></div>
    <form v-if="devMode" @submit.prevent="handleDevLogin" class="dev-form">
      <input v-model="idToken" placeholder="Dev: Google ID token or sub" />
      <button type="submit">Dev Login</button>
    </form>
    <p v-if="error" class="error">{{ error }}</p>
    <p v-if="isLoading" class="loading">Logging in...</p>
  </div>
</template>
<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '../store/auth';
import { useSpacetime } from '../composables/useSpacetime';
import { useGoogleAuth } from '../composables/useGoogleAuth';

const router = useRouter();
const authStore = useAuthStore();
const { loginWithGoogle, connect } = useSpacetime();
const { initializeGoogleSignIn, renderSignInButton, error: googleError } = useGoogleAuth();

const idToken = ref('');
const devMode = ref(import.meta.env.DEV);
const error = ref('');
const isLoading = ref(false);

onMounted(async () => {
  // Initialize Google Sign-In with callback
  initializeGoogleSignIn(async (credential: string) => {
    await login(credential);
  });

  // Render the Google Sign-In button
  renderSignInButton('google-signin-button');

  // Display any Google auth errors
  if (googleError.value) {
    error.value = googleError.value;
  }
});

async function handleDevLogin() {
  await login();
}

async function login(token?: string) {
  error.value = '';
  isLoading.value = true;

  const tokenToUse = token || idToken.value;
  if (!tokenToUse.trim()) {
    error.value = 'Provide token';
    isLoading.value = false;
    return;
  }

  try {
    const { spacetimedb_token, user } = await loginWithGoogle(tokenToUse);

    // Set auth state before connecting to SpacetimeDB
    authStore.setAuth(user, spacetimedb_token);

    // Now connect to SpacetimeDB with authenticated token
    await connect(spacetimedb_token);

    // Navigate to game
    router.push({ name: 'game' });
  } catch (e: any) {
    error.value = e.message || 'Login failed';
    isLoading.value = false;
  }
}
</script>
<style scoped>
.container {
  max-width: 600px;
  margin: 0 auto;
  padding: 24px;
  text-align: center;
}

h2 {
  margin-bottom: 8px;
}

p {
  margin: 12px 0;
  color: #666;
}

.button-container {
  margin: 24px 0;
}

.error {
  color: #c00;
  font-weight: 500;
}

.loading {
  color: #4285f4;
  font-weight: 500;
}

input {
  width: 100%;
  padding: 8px;
  margin-bottom: 8px;
  box-sizing: border-box;
}

.dev-form {
  margin-top: 24px;
  padding-top: 24px;
  border-top: 1px solid #ddd;
  opacity: 0.6;
}
</style>