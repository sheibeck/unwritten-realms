<template>
  <div class="home d-flex flex-column flex-fill">
    <p v-if="!connected">
      🔌 Connecting to Realm...
    </p>
    <div v-else class="flex-fill d-flex flex-column">
      <div class="d-none">
        ✅ Connected as: {{ identity?.toHexString() }}
      </div>
      <GameInterface class="flex-fill d-flex flex-column" :character="character" @characterCreated="onCharacterCreated" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useSpacetime } from '../composable/useSpacetime';
import { getCurrentUser } from '@aws-amplify/auth';
import GameInterface from '../components/GameInterface.vue';

const user = ref();
async function getUserAuth() {
  try {
    const { userId } = await getCurrentUser();
    user.value = userId;
  }
  catch {
    user.value = null;
  }
}

const { connect, connected, identity, conn } = useSpacetime();

function onCharacterCreated(charData: any) {
  console.log('⚡ Character created event received:', charData);

  // Call your reducer or connection method
  conn?.reducers.addCharacter(
    charData.name,
    charData.race,
    charData.profession,
    charData.specialization,
    charData.startingRegionId
  );
}

async function setName() {
  await conn?.reducers.setName("Sterling Web");
}

async function connectSpacetime() {
  const conn = await connect();

  if (!conn) {
    console.warn('Could not connect to SpaceTimeDB');
    return;
  }

  conn.db.character.onInsert((_ctx, row) => {
    console.log('🧙‍♂️ New character inserted:', row);
  });

  conn.db.character.onUpdate((_ctx, row) => {
    console.log('🧙‍♂️ Updated character:', row);
  });

  conn.subscriptionBuilder()
    .onApplied(() => {
      console.log('Initial sync complete.');

      const myCharacter = [...conn.db.character.iter()].find(
        (c) => c.user.toHexString() === conn.identity?.toHexString()
      );

      if (myCharacter) {
        console.log('🎉 Loaded my character:', myCharacter);
        character.value(myCharacter);
      } else {
        console.log('⚠️ No character found');
      }
    })
    .onError((e) => {
      console.log(e);
    })
    .subscribe(['SELECT * FROM character']);

  conn.reducers.onAddCharacter((e) => {
    if (e.event.status.tag === "Failed") {
      console.error("AddCharacter failed:", e.event.status.value);
    } else {
      console.log("AddCharacter succeeded");
    }
  });

  conn.reducers.onSetName((e) => {
    console.log(e.event.status);
  });
}

const character = ref();


onMounted(async () => {
  await getUserAuth();
  await connectSpacetime();
});
</script>

<style scoped>
.home {
  display: flex;
  flex-direction: column;
  flex: 1; /* KEY: stretches to fill parent */
}
</style>
