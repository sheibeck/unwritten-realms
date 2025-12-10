<template>
  <div class="container">
    <div class="header">
      <h1>Unwritten Realms</h1>
      <button class="logout" type="button" @click="logout">Log out</button>
    </div>
    <div class="events">
      <div v-for="e in events" :key="e.id" class="event">
        <span class="time">{{ new Date(e.timestamp).toLocaleTimeString() }}</span>
        <span class="text">{{ e.text }}</span>
      </div>
    </div>
    <form @submit.prevent="send">
      <input v-model="input" placeholder="Describe your action..." />
      <button type="submit">Send</button>
    </form>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { useRouter } from 'vue-router';
import { useGameStore } from '../store/game';
import { useAuthStore } from '../store/auth';
import { useSpacetime } from '../composables/useSpacetime';
import { useNarrativeService } from '../composables/useNarrativeService';
import { useGoogleAuth } from '../composables/useGoogleAuth';

const router = useRouter();
const store = useGameStore();
const authStore = useAuthStore();
const { connect } = useSpacetime();
const { interpret } = useNarrativeService();
const { signOut } = useGoogleAuth();

const input = ref('');
const events = computed(() => store.narrative_events);

onMounted(async () => {
  // Only connect if user is authenticated
  if (authStore.isAuthenticated && authStore.token) {
    await connect(authStore.token);
  } else {
    // Redirect to login if not authenticated
    router.push({ name: 'login' });
  }
});

async function send() {
  if (!input.value.trim()) return;
  const res = await interpret(input.value, { /* TODO */ }, { /* TODO */ });
  if (res?.intent) {
    // await applyIntent(res.intent);
  }
  if (res?.narrative_output) {
    store.addEvent({ id: String(Date.now()), text: res.narrative_output, timestamp: Date.now() });
  }
  input.value = '';
}

async function logout() {
  const emailHint = authStore.user?.email;
  await signOut();
  authStore.logout();
  router.push({ name: 'login' });
}
</script>

<style scoped>
.container { max-width: 800px; margin: 0 auto; padding: 24px; }
.header { display: flex; justify-content: space-between; align-items: center; gap: 12px; margin-bottom: 12px; }
.logout { background: #f3f4f6; border: 1px solid #d1d5db; padding: 8px 12px; border-radius: 6px; cursor: pointer; }
.logout:hover { background: #e5e7eb; }
.events { height: 300px; overflow: auto; border: 1px solid #ddd; margin-bottom: 12px; padding: 8px; }
.event { display: flex; gap: 8px; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco; }
form { display: flex; gap: 8px; }
input { flex: 1; padding: 8px; }
</style>
