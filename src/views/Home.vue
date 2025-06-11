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
      <button class="" @click="addQuest()">Add Quest</button>
      <GameInterface
        v-if="initialized"
        class="flex-fill d-flex flex-column"
        :character="characterStore.currentCharacter"
        :currentRegion="regionStore.currentRegion"
        :linkedRegions="regionStore.linkedRegions"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref, watch } from 'vue';
import type {
  AddCharacterInput,
  AddQuestInput,
  CreateNpcInput,
  CreateStarterRegion,
  DbConnection,
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

  await npcStore.createNpc(npcData as CreateNpcInput);
}

async function addQuest() {
  const createdNpc = npcStore.findNpcByName("Mysterious Stranger");

  const data: AddQuestInput = {
    name: `Mysterious Stranger's Quest`,
    description: `A really cool quest you know you want to do`,
    npcId: createdNpc?.npcId ?? "",
    steps: 1,
    reward: "Gain XP",
    penalty: "None",
    type: "Public",
    repeatable: false
  };

  await questStore.createQuest(data as AddQuestInput);
}

async function connectSpacetime() {
  await mainStore.connectSpacetime();

  if (!mainStore.connection) {
    console.warn('Could not connect to SpaceTimeDB');
    return;
  }

  // ✅ initialize stores
  characterStore.initialize();
  regionStore.initialize();
  npcStore.initialize();
  questStore.initialize(); 

  // Subscribe to space and time
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
const activeRegionUnsub = ref<(() => void) | null>(null);
const initialCharacterUnsub = ref<(() => void) | null>(null);

function subscribeToSpaceTime(conn: DbConnection) {
  const builder = conn.subscriptionBuilder()
    .onApplied((ctx) => {
      console.debug('✅ Subscription initialized.');

      const currentUser = Array.from(ctx.db.user.iter()).find(
        u => u.userId.toHexString() === conn.identity?.toHexString()
      ) || null;
      mainStore.setCurrentUser(currentUser);

      const currentCharacter = Array.from(ctx.db.character.iter()).find(
        c => c.userId.toHexString() === conn.identity?.toHexString()
      ) || null;
      characterStore.setCurrentCharacter(currentCharacter);

      getLinkedRegions(ctx);
      initialized.value = true;
    })
    .onError((e) => {
      console.error('Subscription error:', e);
    });

  const sub = builder.subscribe([
    `SELECT * FROM user WHERE UserId = '${conn.identity?.toHexString()}'`,
    `SELECT * FROM character WHERE UserId = '${conn.identity?.toHexString()}'`,
    `SELECT * FROM region`
  ]);

  initialCharacterUnsub.value = () => sub.unsubscribe();

  // Watch for both character and region being available before unsubscribing
  watch(
    [() => characterStore.currentCharacter, () => regionStore.currentRegion],
    ([char, region]) => {
      if (char && region && initialCharacterUnsub.value) {
        console.debug('🧹 Unsubscribing from initial character/user/region subscription');
        initialCharacterUnsub.value();
        initialCharacterUnsub.value = null;
      }
    },
    { immediate: true }
  );

  // Subscribe to region and NPCs for the current region
  watch(() => regionStore.currentRegion, (region) => {
    if (!region || !conn) return;

    if (activeRegionUnsub.value) {
      activeRegionUnsub.value();
      activeRegionUnsub.value = null;
    }

    const regionSubscriptions = conn.subscriptionBuilder()
      .onApplied(() => {
        console.debug(`🔄 Subscribed to region ${region.name} and its NPCs.`);
      })
      .onError((e) => {
        console.error('Region subscription error:', e);
      })
      .subscribe([
        `SELECT * FROM region WHERE RegionId = '${region.regionId}'`,
        `SELECT * FROM npc WHERE RegionId = '${region.regionId}'`,
        `SELECT q.* FROM quest q JOIN npc n WHERE q.NpcId = n.NpcId AND n.RegionId = '${region.regionId}'`
      ]);

    activeRegionUnsub.value = () => regionSubscriptions.unsubscribe();
    console.debug(`Region subscriptions active`, regionSubscriptions);
  }, { immediate: true });

  conn.reducers.onCreateAndLinkNewRegion((e) => {
    if (e.event.status.tag === 'Failed') {
      console.error('CreateAndLinkNewRegion failed:', e.event.status.value);
    } else {
      console.debug('CreateAndLinkNewRegion succeeded');
    }
  });

  console.debug(`Initial subscriptions active`, sub);
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