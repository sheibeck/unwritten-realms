<template>
   <div>
    <p v-if="connected">
      ✅ Connected as: {{ identity?.toHexString() }}
    </p>
    <p v-else>
      🔌 Connecting to SpaceTimeDB...
    </p>
    <button @click="addCharacter">Add Character</button>
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue';
import { useSpacetime } from '../composable/useSpacetime';

const { connect, connected, identity, conn } = useSpacetime();

function addCharacter() {
  conn?.reducers.add("Spillman " + Math.random(), "Orc", "Warrior", "Riftbender", "The Rock");
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
      console.log('Initial character sync complete.');
    })
    .onError((e) => {
      console.log(e);
    })
    .subscribe(['SELECT * FROM Character']);
});
</script>
