<template>
   <div>
    <p v-if="connected">
      ✅ Connected as: {{ identity?.toHexString() }}
    </p>
    <p v-else>
      🔌 Connecting to SpaceTimeDB...
    </p>
    <button @click="addCharacter()">Add Character</button>
    <button @click="setName()">Set Name</button>
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue';
import { useSpacetime } from '../composable/useSpacetime';

const { connect, connected, identity, conn } = useSpacetime();

async function addCharacter() {
  await conn?.reducers.addCharacter("Spillman", "Orc", "Warrior", "Riftbender", "The Rock");
}

async function setName() {
  await conn?.reducers.setName("Sterling Web");
}

onMounted(async () => {
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
});
</script>
