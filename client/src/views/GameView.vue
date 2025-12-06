<template>
  <div class="container">
    <h1>Unwritten Realms</h1>
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
import { useGameStore } from '../store/game';
import { useSpacetime } from '../composables/useSpacetime';
import { useSessionStore } from '../store/session';
import { useNarrativeService } from '../composables/useNarrativeService';

const store = useGameStore();
const { connected, connect } = useSpacetime();
const session = useSessionStore();
const { interpret } = useNarrativeService();

const input = ref('');
const events = computed(() => store.narrative_events);

onMounted(async () => {
  if (session.token) {
    await connect(session.token);
  } else {
    await connect();
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
</script>

<style scoped>
.container { max-width: 800px; margin: 0 auto; padding: 24px; }
.events { height: 300px; overflow: auto; border: 1px solid #ddd; margin-bottom: 12px; padding: 8px; }
.event { display: flex; gap: 8px; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco; }
form { display: flex; gap: 8px; }
input { flex: 1; padding: 8px; }
</style>
