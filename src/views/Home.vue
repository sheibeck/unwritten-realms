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
import { getCurrentUser } from '@aws-amplify/auth';
import GameInterface from '../components/GameInterface.vue';

const user = ref();
const character = ref();
const initialized = ref(false);  // ✅ NEW: track when subscriptions finish
const { connect, connected } = useSpacetime();

const users = ref();
const characters = ref();
const regions = ref();

async function getUserAuth() {
  try {
    const { userId } = await getCurrentUser();
    user.value = userId;
  } catch {
    console.warn('⚠️ No Cognito user found — player must log in.');
    user.value = null;
  }
}

function onCharacterCreated(charData: any) {
  console.log('⚡ Character created event received:', charData);
  console.log('🚀 Event-driven call:', JSON.stringify(charData, null, 2));

  characters.value.addCharacter(
    charData.name,
    charData.race,
    charData.profession,
    charData.specialization,
    charData.startingRegionId
  );
}

import type { AddCharacterInput, DbConnection } from '../module_bindings/client';
import { useRegions } from '../composable/useRegions';

function addCharacterTest() {
  const testCharacter: AddCharacterInput = {
    // These will be set server-side:
    name: 'Jouctas',
    race: 'Hollowborn',
    profession: 'Arcane',
    specialization: 'Runescribe',
    startingRegion: 'dread_crags',
    strength: 6,
    dexterity: 5,
    intelligence: 10,
    constitution: 4,
    wisdom: 7,
    willpower: 8,
    charisma: 4,
    maxHealth: 40,
    currentHealth: 40,
    maxMana: 40,
    currentMana: 40,
    classAbilities: "Runescript Engraving: Inscribe powerful runes that enhance spells.",
    raceAbilities: "Spectral Shift: Blend with shadows, becoming partially incorporeal. Memories of the Past: Recall hidden knowledge from your history.",
    specializationAbilities: "Runic Inscription: Create powerful runes that alter the flow of magic; Glyph of Focus: Permanently enhance one stat for a brief period; Arcane Echo: Briefly project your energy toward a target.",
    level: 1,
    xp: 0,
    primaryWeapon: 'Arcane Quill',
    secondaryWeapon: 'Ethereal Dagger',
  };

  characters.value.addCharacter(testCharacter);
}

async function connectSpacetime() {
  const connectedConn = await connect();

  if (!connectedConn) {
    console.warn('Could not connect to SpaceTimeDB');
    return;
  }

  subscribeToUser(connectedConn);
  subscribeToCharacter(connectedConn);
  subscribeToRegion(connectedConn);

  connectedConn.reducers.onSetName((e) => {
    console.log(e.event.status);
  });
}

function subscribeToUser(conn: DbConnection) {
  conn.subscriptionBuilder()
    .onApplied(() => {
      users.value = useUsers(conn);
      console.log('✅ User subscription initialized.');
    })
    .onError((e) => {
      console.error('User subscription error:', e);
    })
    .subscribe([`SELECT * FROM user WHERE UserId = '${conn.identity?.toHexString()}'`]);
}

function subscribeToCharacter(conn: DbConnection) {
  conn.subscriptionBuilder()
    .onApplied(() => {
      characters.value = useCharacters(conn);
      console.log('✅ Character subscription initialized.');

      const iterator = conn.db.character.iter()[Symbol.iterator]();
      const firstResult = iterator.next();

      if (firstResult.done) {
        console.log('⚠️ No character found');
      } else {
        const myCharacter = firstResult.value;
        console.log('🎉 Loaded my character:', myCharacter);
        character.value = myCharacter;
      }

      initialized.value = true;
    })
    .onError((e) => {
      console.error('Character subscription error:', e);
    })
    .subscribe([`SELECT * FROM character WHERE UserId = '${conn.identity?.toHexString()}'`]);
}

function subscribeToRegion(conn: DbConnection) {
  conn.subscriptionBuilder()
    .onApplied(() => {
      regions.value = useRegions(conn);
      console.log('✅ Region subscription initialized.');
      // Add your useRegions(conn) or similar if you have a region composable
    })
    .onError((e) => {
      console.error('Region subscription error:', e);
    })
    .subscribe(['SELECT * FROM region']);
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