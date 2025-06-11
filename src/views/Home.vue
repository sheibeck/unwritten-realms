<template>
  <div class="home d-flex flex-column flex-fill">
    <p v-if="!mainStore.currentUser" class="ms-4 mt-4">
      🌫️ <strong>The mists of the Verdant Shard swirl and shudder.</strong><br />
      A voice echoes softly in your mind, neither welcoming nor hostile, but full of knowing:<br /><br />
      <em>“Ah… A soul stands at the threshold, yet the Veil does not know your name.
      The portals remain closed to those unmarked by the Weave.
      Step back, traveler, and bind your essence — only then may you awaken in this realm.”</em><br /><br />
      ✨ Please log in to tether your spirit to the realm and begin your journey.
    </p>
    <p v-else-if="!mainStore.connected" class="ms-4 mt-4">
      🔌 Connecting to Realm...
    </p>
    <div v-else class="flex-fill d-flex flex-column">
      <button class="" @click="addStarterRegion()">Add Starter Region</button>
      <button class="" @click="addCharacterTest()">Add Test Character</button>
      <button class="" @click="addNpc()">Add Npc</button>
      <GameInterface
        v-if="initialized"
        class="flex-fill d-flex flex-column"
        :character="characterStore.currentCharacter"
        :currentRegion="regionStore.currentRegion"
        :linkedRegions="regionStore.linkedRegions"
        @characterCreated="onCharacterCreated"
        @updateCharacter="onUpdateCharacter"
        @createAndLinkRegion="onRegionCreatedAndLinked"
        @createQuest="onCreateQuest"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import type {
  AddCharacterInput,
  CreateAndLinkNewRegion,
  CreateNpcInput,
  CreateStarterRegion,
  DbConnection,
  Quest,
  UpdateCharacterInput,
} from '@/module_bindings/client';
import { useRegionStore } from '@/stores/regionStore'; // ✅ Pinia store
import GameInterface from '@/components/GameInterface.vue';
import { useCharacterStore } from '@/stores/characterStore';
import { useMainStore } from '@/stores/mainStore';
import { useQuestStore } from '@/stores/questStore';
import { useNpcStore } from '@/stores/npcStore';

const mainStore = useMainStore();           // ✅ store
const characterStore = useCharacterStore(); // ✅ store
const regionStore = useRegionStore();       // ✅ store
const questStore = useQuestStore();
const npcStore = useNpcStore();
const initialized = ref(false);

function onCharacterCreated(charData: AddCharacterInput) {
  console.debug('⚡ Character created event received:', charData);
  characterStore.addCharacter(charData);
}

function onUpdateCharacter(charData: UpdateCharacterInput) {
  console.debug('⚡ Character updated event received:', charData);
  characterStore.updateCharacter(charData);
}

async function onRegionCreatedAndLinked(data: CreateAndLinkNewRegion) {
  console.debug('⚡ Region created event received:', data);
  const newRegion = await regionStore.createAndLinkNewRegion(data); // ✅ updated

  //move character to new region
  characterStore.setCurrentCharacterLocation(newRegion);
}

function onCreateQuest(data: Quest) {
  console.debug('⚡ Quest created event received:', data);
  questStore.createQuest(data);
}

async function addStarterRegion() {
  const testStarterRegion: CreateStarterRegion = { 
    "name": "Hollow Hill", 
    "description": "A hilly outcropping that overlooks a desolate valley. A small town is here", 
    "fullDescription": "A really lengthy description of this region from initial crdation",
    "climate": "Rainy", 
    "culture": "Scavengers", 
    "resources": ['Rocks', 'Salt', 'Bone Fragments'] 
  };
  await regionStore.createStarterRegion(testStarterRegion);
}

async function addCharacterTest() {

  const createdRegion = regionStore.findRegionByName("Hollow Hill");

  if (createdRegion) {
    const testCharacter: AddCharacterInput = {
      name: 'Jouctas',
      description: 'Pale, guant and humanoid, a Hollowborn dressed in a drab, gray cloak.',
      race: 'Hollowborn',
      archetype: 'Mystic',
      profession: 'Runescribe',
      startingRegion: createdRegion.regionId,
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

    await characterStore.addCharacter(testCharacter);
  }
}

async function addNpc() {
  const createdRegion = regionStore.findRegionByName("Hollow Hill");

  const npcData = {
    name: `Mysterious Stranger`, // Or from context
    description: `A shadowed figure cloaked in riddles.`,
    //faction: `Wanderers`,
    race: "Elf",
    profession: "Unknown",
    maxHealth: 100,
    currentHealth: 100,
    maxMana: 150,
    currentMana: 150,
    abilities: "Spellcasting",
    regionId: createdRegion?.regionId
  };

  const createdNpc = await npcStore.createNpc(npcData as CreateNpcInput);
  console.log(createdNpc);
}

async function connectSpacetime() {
  await mainStore.connectSpacetime();

  if (!mainStore.connection) {
    console.warn('Could not connect to SpaceTimeDB');
    return;
  }

  regionStore.initialize();    // ✅ initialize store
  characterStore.initialize(); // ✅ initialize store
  questStore.initialize(); // ✅ initialize store
  npcStore.initialize();

  subscribeToSpaceTime(mainStore.connection);
}

function getLinkedRegions(ctx: any) {
  if (characterStore.currentCharacter) {
    const currentRegion: any = Array.from(ctx.db.region.iter()).find(
      (r: any) => characterStore.currentCharacter?.currentLocation === r.regionId
    ) || null;
    regionStore.setCurrentRegion(currentRegion);

    const filteredRegions: any = Array.from(ctx.db.region.iter()).filter(
      (r: any) => currentRegion.linkedRegionIds.includes(r.regionId)
    );
    regionStore.setLinkedRegion(filteredRegions);
  } else {
    regionStore.setCurrentRegion(null);
    regionStore.setLinkedRegion([]);
  }
}

function subscribeToSpaceTime(conn: DbConnection) {
  const subscriptions = conn.subscriptionBuilder()
    .onApplied((ctx) => {
      console.debug('✅ Subscription initialized.');

      const currentUser = Array.from(ctx.db.user.iter()).find(
        u => u.userId.toHexString() === conn.identity?.toHexString()
      ) || null;
      mainStore.setCurrentUser(currentUser)

      const currentCharacter = Array.from(ctx.db.character.iter()).find(
        c => c.userId.toHexString() === conn.identity?.toHexString()
      ) || null;
      characterStore.setCurrentCharacter(currentCharacter);

      getLinkedRegions(ctx);
      initialized.value = true;
    })
    .onError((e) => {
      console.error('Subscription error:', e);
    })
    .subscribe([
      `SELECT * FROM user WHERE UserId = '${conn.identity?.toHexString()}'`,
      `SELECT * FROM character WHERE UserId = '${conn.identity?.toHexString()}'`,
      `SELECT * FROM region`,
      `SELECT * FROM npc`,
    ]);

  conn.reducers.onCreateAndLinkNewRegion((e) => {
    if (e.event.status.tag === 'Failed') {
      console.error('CreateAndLinkNewRegion failed:', e.event.status.value);
    } else {
      console.debug('CreateAndLinkNewRegion succeeded');
    }
  });

  console.debug(`Subscriptions active`, subscriptions);
}

onMounted(async () => {
  await mainStore.authenticateUser();

  if (mainStore.currentUserId) {
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