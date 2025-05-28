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
          <h5 class="modal-title">📜 {{ character.name }}</h5>
          <button type="button" class="btn-close btn-close-white" @click="$emit('close')"></button>
        </div>

        <div class="modal-body">
          <div v-if="character">
            <div class="row">
              <!-- LEFT COLUMN -->
              <div class="col-12 col-md-6">
                <!-- Basic Info -->
                <section class="mb-4">
                  <h3 class="h5">Basic Info</h3>
                  <p>{{ character.race }} &mdash; {{ character.specialization }} ({{ character.profession }})</p>
                  <div class="row">
                    <div class="col-6">
                         <p>Health: {{ character.currentHealth ?? '—' }} / {{ character.maxHealth ?? '—' }}</p>
                         <p><strong>Level:</strong> {{ character.level ?? '—' }}</p>
                    </div>
                    <div class="col-6">
                        <p>Mana: {{ character.currentMana ?? '—' }} / {{ character.maxMana ?? '—' }}</p>
                        <p><strong>XP:</strong> {{ character.xp ?? '—' }}</p>
                    </div>
                  </div>
                </section>

                <!-- Attributes (two-column grid) -->
                <section class="mb-4">
                  <h3 class="h5">Attributes</h3>
                  <div class="row">
                    <div class="col-6">
                      <p>💪 Strength: {{ character.strength ?? '—' }}</p>
                      <p>🏃 Dexterity: {{ character.dexterity ?? '—' }}</p>
                      <p>🧠 Intelligence: {{ character.intelligence ?? '—' }}</p>
                      <p>❤️ Constitution: {{ character.constitution ?? '—' }}</p>
                    </div>
                    <div class="col-6">
                      <p>👁️ Wisdom: {{ character.wisdom ?? '—' }}</p>
                      <p>🔥 Willpower: {{ character.willpower ?? '—' }}</p>
                      <p>😎 Charisma: {{ character.charisma ?? '—' }}</p>
                    </div>
                  </div>
                </section>

                <!-- Abilities -->
                <section class="mb-4">
                  <h3 class="h5">Abilities</h3>
                  <p><strong>Class:</strong> {{ character.classAbilities || '—' }}</p>
                  <p><strong>Race:</strong> {{ character.raceAbilities || '—' }}</p>
                  <p><strong>Specialization:</strong> {{ character.specializationAbilities || '—' }}</p>
                </section>
              </div>

              <!-- RIGHT COLUMN -->
              <div class="col-12 col-md-6">
                <!-- Equipment -->
                <section class="mb-4">
                  <h3 class="h5">Equipment</h3>
                  <p>Head: {{ character.head || '—' }}</p>
                  <p>Shoulders: {{ character.shoulders || '—' }}</p>
                  <p>Back: {{ character.back || '—' }}</p>
                  <p>Chest: {{ character.chest || '—' }}</p>
                  <p>Arms: {{ character.arms || '—' }}</p>
                  <p>Hands: {{ character.hands || '—' }}</p>
                  <p>Legs: {{ character.legs || '—' }}</p>
                  <p>Feet: {{ character.feet || '—' }}</p>
                  <p>Rings: {{ character.rings || '—' }}</p>
                  <p>Necklace: {{ character.necklace || '—' }}</p>
                  <p>Earrings: {{ character.earrings || '—' }}</p>
                  <p>Relic: {{ character.relic || '—' }}</p>
                  <p>Primary Weapon: {{ character.primaryWeapon || '—' }}</p>
                  <p>Secondary Weapon: {{ character.secondaryWeapon || '—' }}</p>
                </section>

                <!-- Inventory -->
                <section class="mb-4">
                  <h3 class="h5">Inventory</h3>
                  <p>{{ character.inventoryItems || 'None' }}</p>
                </section>
              </div>
            </div>
          </div>

          <div v-else class="text-danger">
            No character data available.
          </div>
        </div>

        <div class="modal-footer">
          <button class="btn btn-secondary" @click="$emit('close')">Close</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Character } from '../module_bindings/client';

const props = defineProps<{
  character: Character;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
}>();
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
