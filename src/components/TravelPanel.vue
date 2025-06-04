<template>
  <div
    class="modal fade show"
    tabindex="-1"
    style="display: block; background: rgba(0, 0, 0, 0.7);"
    @click.self="$emit('close')"
  >
    <div class="modal-dialog modal-xl modal-dialog-centered">
      <div class="modal-content bg-dark text-white">
        <div class="modal-header">
          <h5 class="modal-title">🌍 Travel Options</h5>
          <button type="button" class="btn-close btn-close-white" @click="$emit('close')"></button>
        </div>
        <div class="modal-body">
          <p>Current Region: <strong>{{ currentRegion.name }}</strong> (Tier {{ currentRegion.tier }})</p>
          <p>Your Energy: ⚡ {{ playerEnergy }}</p>

          <ul class="list-group mb-3">
            <li
              v-for="region in linkedRegions"
              :key="region.regionId"
              class="list-group-item bg-secondary d-flex justify-content-between align-items-center"
            >
              <div>
                <strong>{{ region.name }}</strong> (Tier {{ region.tier }})<br />
                Cost: ⚡ {{ region.travelEnergyCost }}
              </div>
              <button
                class="btn btn-sm btn-primary"
                :disabled="playerEnergy < region.travelEnergyCost"
                @click="$emit('travel', region, currentRegion)"
              >
                Travel
              </button>
            </li>
            <li class="list-group-item bg-secondary d-flex justify-content-between align-items-center">
              <div>
                <strong>Explore a New Region</strong> (Tier Unknown)<br />
                Cost: ⚡ 100
              </div>
              <button
                class="btn btn-sm btn-primary"
                :disabled="playerEnergy < 100"
                @click="$emit('explore', currentRegion)"
              >
                Travel
              </button>
            </li>
          </ul>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" @click="$emit('close')">Close</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Region } from '../module_bindings/client';

const props = defineProps<{
  currentRegion: Region;
  linkedRegions: Region[];
  playerEnergy: number;
}>();
console.log(`Props initialized`, props);

const emit = defineEmits<{
  (e: 'travel', toRegion: Region, fromRegion: Region): void;
  (e: 'explore', fromRegion: Region): void;
  (e: 'close'): void;
}>();
console.log(`Emits initialized`, emit);
</script>

<style scoped>
.modal-content {
  min-height: 60vh;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
}

.modal-body {
  flex: 1 1 auto;
  overflow-y: auto;
}
</style>

