<template>
  <div class="home d-flex flex-column flex-fill">
    <p v-if="!user" class="ms-4 mt-4">
      🌫️ <strong>The mists of the Verdant Shard swirl and shudder.</strong><br />
      A voice echoes softly in your mind, neither welcoming nor hostile, but full of knowing:<br /><br />
      <em>“Ah… A soul stands at the threshold, yet the Veil does not know your name.
      The portals remain closed to those unmarked by the Weave.
      Step back, traveler, and bind your essence — only then may you awaken in this realm.”</em><br /><br />
      ✨ Please log in to tether your spirit to the realm and begin your journey.
    </p>
    <p v-else-if="!connected" class="ms-4 mt-4">
      🔌 Connecting to Realm...
    </p>
    <div v-else class="flex-fill d-flex flex-column">
      <button class="" @click="addCharacterTest()">Add Test Character</button>
      <GameInterface
        v-if="initialized"
        class="flex-fill d-flex flex-column"
        :character="character"
        :currentRegion="currentRegion"
        :linkedRegions="linkedRegions"
        @characterCreated="onCharacterCreated"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useSpacetime } from '../composable/useSpacetime';
import { useUsers } from '../composable/useUsers';
import { useCharacters } from '../composable/useCharacters';
import { useRegions } from '../composable/useRegions';
import { getCurrentUser } from '@aws-amplify/auth';
import GameInterface from '../components/GameInterface.vue';
import type { AddCharacterInput, Character, DbConnection, Region } from '../module_bindings/client';

const { connect, connected } = useSpacetime();
const usersComposable = ref();
const charactersComposable = ref();
const regionsComposable = ref();

const user = ref();
const character = ref();
const currentRegion = ref();
const linkedRegions = ref<Region[]>([]);
const initialized = ref(false);

async function getUserAuth() {
  try {
    const { userId } = await getCurrentUser();
    user.value = userId;
  } catch {
    console.warn('⚠️ No Cognito user found — player must log in.');
    user.value = null;
  }
}

function onCharacterCreated(charData: AddCharacterInput) {
  console.log('⚡ Character created event received:', charData);
  console.log('🚀 Event-driven call:', JSON.stringify(charData, null, 2));

  charactersComposable.value.addCharacter(charData);
}

function addCharacterTest() {
  const testCharacter: AddCharacterInput = {
    // These will be set server-side:
    name: 'Jouctas',
    description: 'Pale, guant and humanoid, a Hollowborn dressed in a drab, gray cloak.',
    race: 'Hollowborn',
    archetype: 'Mystic',
    profession: 'Runescribe',
    startingRegion: 'cd7cd7b7686d4f77b5ea76901e866875',
    strength: 6,
    dexterity: 5,
    intelligence: 10,
    constitution: 4,
    wisdom: 7,
    charisma: 4,
    maxHealth: 40,
    currentHealth: 40,
    maxMana: 40,
    currentMana: 40,
    raceAbilities: "Spectral Shift: Blend with shadows, becoming partially incorporeal. Memories of the Past: Recall hidden knowledge from your history.",
    professionAbilities: "Runescript Engraving: Inscribe powerful runes that enhance spells.",
    level: 1,
    xp: 1,
    equippedWeapon: 'Arcane Quill',
  };

  charactersComposable.value.addCharacter(testCharacter);
  character.value = testCharacter as Character;
}

async function connectSpacetime() {
  const connectedConn = await connect();

  if (!connectedConn) {
    console.warn('Could not connect to SpaceTimeDB');
    return;
  }

  usersComposable.value = useUsers(connectedConn);
  charactersComposable.value = useCharacters(connectedConn);
  regionsComposable.value = useRegions(connectedConn);

  subscribeToUser(connectedConn);

  connectedConn.reducers.onSetName((e) => {
    console.log(e.event.status);
  });
}

function subscribeToUser(conn: DbConnection) {
  const subscriptions = conn.subscriptionBuilder()
    .onApplied((ctx) => {
      console.log('✅ Subscription initialized.');

      user.value = Array.from(ctx.db.user.iter()).find(
        u => u.userId.toHexString() === conn.identity?.toHexString()
      ) || null;

      character.value = Array.from(ctx.db.character.iter()).find(
        c => c.userId.toHexString() === conn.identity?.toHexString()
      ) || null;

      if (character.value) {
        currentRegion.value = Array.from(ctx.db.region.iter()).find(
          r => character.value.currentLocation === r.regionId
        ) || null;

        const filteredRegions = Array.from(ctx.db.region.iter()).filter(
          r => currentRegion.value?.linkedRegionIds.includes(r.regionId)
        );

        // ✅ Update array in place to preserve reactivity
        linkedRegions.value.splice(0, linkedRegions.value.length, ...filteredRegions);
      } else {
        currentRegion.value = null;
        linkedRegions.value.splice(0, linkedRegions.value.length); // clear array
      }

      initialized.value = true;
    })
    .onError((e) => {
      console.error('Subscription error:', e);
    })
    .subscribe([
      `SELECT * FROM user WHERE UserId = '${conn.identity?.toHexString()}'`,
      `SELECT * FROM character WHERE UserId = '${conn.identity?.toHexString()}'`,
      `SELECT * FROM region`,
    ]);

  console.log(`Subscriptions active`, subscriptions);
}


onMounted(async () => {
  await getUserAuth();

  if (user.value) {
    await connectSpacetime();
  } else {
    console.warn('User is not logged in — skipping SpaceTimeDB connection.');
  }
});
</script>


<style scoped>
.home {
  display: flex;
  flex-direction: column;
  flex: 1; /* KEY: stretches to fill parent */
}
</style>