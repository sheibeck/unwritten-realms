<template>
  <router-view />
</template>
<script setup lang="ts">
import { onMounted } from 'vue';
import { useAuthStore } from './store/auth';

const authStore = useAuthStore();

// Restore authentication state on app load
onMounted(() => {
  authStore.restoreAuth();
});
</script>
<style>
:root { font-family: Inter, system-ui, Avenir, Helvetica, Arial, sans-serif; }
:root {
  /* Dark theme variables */
  --bg: #0b1220;
  --panel: #0f1724;
  --muted: #9ca3af;
  --border: #1f2937;
  --accent: #60a5fa;
  --text: #e6eef8;
  --error: #f87171;
}
body { margin: 0; background: var(--bg); color: var(--text); }
</style>
