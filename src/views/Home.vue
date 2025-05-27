<template>
  <div class="home d-flex flex-column flex-fill">
    <p v-if="!connected">
      🔌 Connecting to Realm...
    </p>
    <div v-else class="flex-fill d-flex flex-column">
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
const { connect, connected, identity, conn } = useSpacetime();

const users = ref();
const characters = ref();

async function getUserAuth() {
  try {
    const { userId } = await getCurrentUser();
    user.value = userId;
  } catch {
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

function addCharacterTest() {
  const jsonString = `{
    "name": "Jouctas",
    "race": "Hollowborn",
    "profession": "Arcane",
    "specialization": "Runescribe",
    "startingRegionId": "anything"
  }`;
  const charData = JSON.parse(jsonString);

  characters.value.addCharacter(
    String(charData.name).trim(),
    String(charData.race).trim(),
    String(charData.profession).trim(),
    String(charData.specialization).trim(),
    String(charData.startingRegionId).trim()
  );
}

async function connectSpacetime() {
  const connectedConn = await connect();

  if (!connectedConn) {
    console.warn('Could not connect to SpaceTimeDB');
    return;
  }

  connectedConn.subscriptionBuilder()
    .onApplied(() => {
      users.value = useUsers(connectedConn);
      characters.value = useCharacters(connectedConn);

      console.log('Initial sync complete.');

      const iterator = connectedConn.db.character.iter()[Symbol.iterator]();
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
      console.error(e);
    })
    .subscribe([`SELECT * FROM character WHERE UserId = '${connectedConn.identity?.toHexString()}'`]);

  connectedConn.reducers.onSetName((e) => {
    console.log(e.event.status);
  });
}

onMounted(async () => {
  await getUserAuth();
  await connectSpacetime();


  console.log('Users:', users.value);
  console.log('Characters:', characters.value);
});
</script>


<style scoped>
.home {
  display: flex;
  flex-direction: column;
  flex: 1; /* KEY: stretches to fill parent */
}
</style>