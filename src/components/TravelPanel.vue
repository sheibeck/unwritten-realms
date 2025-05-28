<template>
  <div class="travel-panel">
    <h2>🌍 Travel Options</h2>
    <p>Current Region: <strong>{{ currentRegion.name }}</strong> (Tier {{ currentRegion.tier }})</p>
    <p>Your Energy: ⚡ {{ playerEnergy }}</p>

    <ul class="region-list">
      <li v-for="region in linkedRegions" :key="region.regionId">
        <div class="region-entry">
          <div class="region-info">
            <strong>{{ region.name }}</strong> (Tier {{ region.tier }})
            <br />
            Cost: ⚡ {{ region.travelEnergyCost }}
          </div>
          <button
            class="btn btn-sm btn-primary"
            :disabled="playerEnergy < region.travelEnergyCost"
            @click="$emit('travel', region.regionId)"
          >
            Travel
          </button>
        </div>
      </li>
    </ul>

    <button class="btn btn-secondary close-btn" @click="$emit('close')">Close</button>
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue';

const props = defineProps<{
  currentRegion: any;
  linkedRegions: any;
  playerEnergy: number;
}>();

const emit = defineEmits<{
  (e: 'travel', regionId: string): void;
  (e: 'close'): void;
}>();

onMounted(() => {
    const x = 1;
});
</script>

<style scoped>
.travel-panel {
  position: absolute;
  top: 10%;
  left: 10%;
  right: 10%;
  bottom: 10%;
  background: #222;
  color: #fff;
  border: 2px solid #555;
  border-radius: 8px;
  padding: 1rem;
  overflow-y: auto;
  z-index: 1000;
  display: flex;
  flex-direction: column;
}

h2 {
  margin-top: 0;
  margin-bottom: 1rem;
}

.region-list {
  list-style: none;
  padding: 0;
  margin: 0;
  flex: 1;
  overflow-y: auto;
}

.region-entry {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.75rem;
  padding: 0.5rem;
  background: #333;
  border-radius: 4px;
}

.region-info {
  flex: 1;
}

.close-btn {
  margin-top: 1rem;
}
</style>
