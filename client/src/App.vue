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
body { margin: 0; }
</style>
