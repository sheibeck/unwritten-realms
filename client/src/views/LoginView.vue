<template>
  <div class="container">
    <h2>Login</h2>
    <p>Sign in with your Google account.</p>
   <button @click="handleGoogleLogin">Sign in with Google</button>
    <div class="error" v-if="error">{{ error }}</div>

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
const { getGoogleIdToken, signOut, error: googleError } = useGoogleAuth();

const idToken = ref('');
const devMode = ref(import.meta.env.DEV);
const error = ref('');
const isLoading = ref(false);


async function handleGoogleLogin() {
  // Try promise-style first (recommended). Fallback to callback-style if the composable returns void.
  try {
    // getGoogleIdToken returns a Promise<string> when called without a callback
    // @ts-ignore
    const token = await getGoogleIdToken();
    if (token) {
      // ensure token is a JWT and contains email claim
      if (token.includes('.') && token.split('.').length === 3) {
        try {
          const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g,'+').replace(/_/g,'/')));
          if (!payload?.email) {
            error.value = 'ID token missing email claim';
            return;
          }
        } catch (e) {
          error.value = 'Failed to parse ID token';
          return;
        }

        await login(token as string);
        return;
      } else {
        error.value = 'Expected ID token (JWT) but received non-JWT token';
        return;
      }
    }
  } catch (e) {
    // fall through to callback style below if the promise failed to load google script
  }
}

onMounted(async () => {
  // Display any Google auth errors
  if (googleError.value) {
    error.value = googleError.value;
  }
});

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
    const { id_token, email } = await loginWithGoogle(tokenToUse);

    // Connect to SpacetimeDB with authenticated token (Google JWT)
    await connect(id_token);

    // Only mark authenticated after a successful DB connection
    authStore.setAuth({
      id: '',
      email,
      provider: 'google',
      provider_sub: '',
      created_at: Date.now()
    }, id_token);

    // Redirect to Game.vue after successful login
    router.push({ name: 'game' });

    isLoading.value = false;
  } catch (e: any) {
    error.value = e.message || 'Login failed';
    // Ensure auth state is cleared on failure so login route is accessible
    authStore.logout();
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
  background: transparent;
}

h2 {
  margin-bottom: 8px;
  color: var(--text);
}

p {
  margin: 12px 0;
  color: var(--muted);
}

.button-container {
  margin: 24px 0;
}

.error {
  color: var(--error);
  font-weight: 500;
}

.loading {
  color: var(--accent);
  font-weight: 500;
}

input {
  width: 100%;
  padding: 8px;
  margin-bottom: 8px;
  box-sizing: border-box;
  background: transparent;
  border: 1px solid var(--border);
  color: var(--text);
}

.dev-form {
  margin-top: 24px;
  padding-top: 24px;
  border-top: 1px solid var(--border);
  opacity: 0.6;
}
</style>