<template>
  <div class="travel-panel">
    <h3>Available Travel Destinations</h3>
    <ul>
      <li v-for="region in linkedRegions" :key="region.regionId">
        <strong>{{ region.name }}</strong> (Tier {{ region.tier }}, {{ region.travelEnergyCost }} ⚡)
        <button
          class="btn btn-sm btn-primary"
          :disabled="playerEnergy < region.travelEnergyCost"
          @click="$emit('travel', region.regionId)"
        >
          Travel
        </button>
      </li>
    </ul>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  currentRegion: any;
  linkedRegions: any[];
  playerEnergy: number;
}>();

defineEmits<{ (e: 'travel', regionId: string): void }>();
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
}
</style>
