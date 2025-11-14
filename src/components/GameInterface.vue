<template>
  <div class="game-interface">
    <!-- Main Chat / Play Area -->
    <div class="chat-window" ref="chatContainer">
     <div v-for="(msg, index) in messages" :key="index" class="message" v-html="msg.html"></div>
      <div v-if="isLoading" class="loading-spinner">
        {{ getLoadingMessage() }}
      </div>
    </div>

    <!-- Chat Input Area -->
    <div class="chat-input-area">
      <input
        ref="chatInput"
        v-model="userInput"
        @keyup.enter="sendMessage()"
        class="form-control"
        type="text"
        placeholder="Type your command..."
        :disabled="isLoading"
      />
      <button class="btn btn-primary" :disabled="isLoading" @click="sendMessage()">Send</button>
    </div>

    <!-- Fixed Bottom Toolbar -->
    <div class="toolbar">
      <div class="toolbar-icons">
        <button class="btn btn-dark" :disabled="!character" @click="toggleCharacterPanel" title="Character">
          <i class="bi bi-person-fill"></i>
        </button>
        <button class="btn btn-dark" @click="" title="Quests">
          <i class="bi bi-journal-text"></i>
        </button>
        <button class="btn btn-dark" @click="" title="Factions">
          <i class="bi bi-people-fill"></i>
        </button>
        <button class="btn btn-dark" :disabled="!currentRegion" @click="toggleTravelPanel" title="Travel">
          <i class="bi bi-globe"></i>
        </button>
      </div>
    </div>

    <!-- Panels -->
    <TravelPanel
      v-if="showTravel"
      :currentRegion="currentRegion"
      :linkedRegions="linkedRegions"
      :playerEnergy="playerEnergy"
      @travel="handleTravel"
      @explore="handleExplore"
      @close="showTravel = false"
    />
    <CharacterPanel
      v-if="showCharacter"
      :character="character"
      @close="showCharacter = false"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import type { Region } from '@/spacetimedb/client';
import TravelPanel from './TravelPanel.vue';
import CharacterPanel from './CharacterPanel.vue';
import { useRegionStore } from '@/stores/regionStore';
import { useCharacterStore } from '@/stores/characterStore';
import { useQuestStore } from '@/stores/questStore';
import { useNpcStore } from '@/stores/npcStore';
import { useInteractionEngine } from '@/composables/useInteractionEngine';
// normalizeAction removed; use canonical action strings directly
import { emitPhase } from '@/engine/onboardingEvents';
import { useMessages } from '@/composables/useMessages';
import { useGameContext } from '@/composables/useGameContext';
import { useLocalActions } from '@/composables/useLocalActions';
import { useGameThreads } from '@/composables/useGameThreads';
import { useCharacterCreation } from '@/composables/useCharacterCreation';
import { useAiHandler } from '@/composables/useAiHandler';
import { useMainStore } from '@/stores/mainStore';

const interactionEngine = useInteractionEngine();
const regionStore = useRegionStore();
const characterStore = useCharacterStore();
const questStore = useQuestStore();
const npcStore = useNpcStore();
const mainStore = useMainStore();
const props = defineProps<{ character: any, currentRegion: any, linkedRegions: any }>();
const chatContainer = ref<HTMLDivElement | null>(null);
const chatInput = ref<HTMLInputElement | null>(null);
const { messages, pushMessage } = useMessages(() => chatContainer.value, () => chatInput.value);
const userInput = ref('');
const isLoading = ref(false);
const { getErrorMessage, getLoadingMessage } = useGameContext();
const { resolveLocalAction } = useLocalActions(characterStore);
const { activeGameThreadId, updateMainThread, initFromStorage } = useGameThreads();
function buildContext() {
  const ctx = { character: { ...props.character }, region: props.currentRegion, npcs: Array.from(npcStore.npcs.values()), quests: Array.from(questStore.quests.values()) };
  delete (ctx.character as any)?.userId;
  return ctx;
}
// Resolver ref (set when waiting for next input)
let _nextUserInputResolver: ((msg: string) => void) | null = null; // resolver set when awaiting user input
function getNextUserInput(): Promise<string> { return new Promise(r => { void _nextUserInputResolver; _nextUserInputResolver = r; }); }
const { handleCharacterCreationLoopStreaming } = useCharacterCreation({ characterStore, mainStore, buildContext, pushMessage, updateMainThread });
const { sendMessage: aiSendMessage } = useAiHandler({ characterStore, regionStore, questStore, npcStore, mainStore, activeGameThreadId, updateMainThread, buildContext, resolveLocalAction, pushMessage, getErrorMessage, getNextUserInput, handleCharacterCreationLoopStreaming });

const hasActiveCharacter = ref(false);
const newCharacter = ref(true);

if (props.character) {
  hasActiveCharacter.value = true;
  pushMessage(`🌟 Welcome back, ${props.character.name}!`);
  pushMessage(`The realms stir with possibility — what adventure will you spark next?`);
} else {
  newCharacter.value = true;
  pushMessage('✨ Welcome, brave soul, to Unwritten Worlds!');
  pushMessage('Your story has yet to be inked across the stars.');
  emitPhase('INITIATION', mainStore.currentUserId || null);
}

// activeGameThreadId managed by useGameThreads

// Wrapper for AI send with quest interaction and user echo
async function sendMessage(overrideMessage = false, msg = '', additionalData: Record<string, any> = {}) {
  const input = overrideMessage ? msg : userInput.value.trim();
  if (!input) return;
  if (interactionEngine.isAwaiting('awaitingQuestResponse')) {
    const accepted = await interactionEngine.handleQuestResponse(input);
    await pushMessage(accepted ? '📜 Quest accepted.' : '🌀 Quest declined.');
    userInput.value = '';
    return;
  }
  await pushMessage(`🗨️ You: ${input}`);
  userInput.value = '';
  await aiSendMessage(overrideMessage, input, additionalData);
}

// Local action resolution handled in useLocalActions

// Context builder handled above

// pushMessage provided by useMessages

// updateMainThread provided by useGameThreads

// parseOutput removed (handled inside composables)

// Waits for next user input during loop
// getNextUserInput provided above for character creation loop

// chatInput ref defined earlier

// scrollToBottom handled by useMessages

// Character creation loop provided by useCharacterCreation

// Character add handled in composables

// Region creation handled in AI handler

// Character update handled elsewhere

// Loading & error messages provided by useGameContext

//Character
const showCharacter = ref(false);
function toggleCharacterPanel() {
  showCharacter.value = !showCharacter.value;
}

//Travel
const showTravel = ref(false);
const playerEnergy = ref(100); // pull from DB or props

function toggleTravelPanel() {
  showTravel.value = !showTravel.value;
}

async function handleTravel(targetRegion: Region, originRegion: Region) {
  const msg = `Traveling from ${originRegion.name} to ${targetRegion.name}`;
  sendMessage(true, msg, { targetRegion: targetRegion, originRegion: originRegion });
  showTravel.value = false;
}

async function handleExplore(originRegion: Region) {
  const msg = `Exploring from ${originRegion.name}`;
  sendMessage(true, msg, { originRegion: originRegion });
  showTravel.value = false;
}

// buildPayload now handled in useAiHandler

// handleAiResponse now part of useAiHandler

// Optional future abort hook
// Aborting not yet wired to UI; keep function commented for future use
// function abortStreaming() {
//   if (isStreaming.value) {
//     abort();
//     isStreaming.value = false;
//     pushMessage('⛔ Stream aborted.');
//   }
// }


onMounted(() => {
  initFromStorage();
  emitPhase('AUTH', mainStore.currentUserId || null);
  emitPhase('CHECK_CHARACTER', mainStore.currentUserId || null, { hasCharacter: !!props.character });
  // Auto-start character creation if no existing character
  if (!props.character) {
    // Seed initial message instructing strict JSON structure and first step only.
    //const initialCreationPrompt = `Begin character creation. Respond ONLY with a single valid JSON object matching this shape: {"narrative":"<text asking me to choose race only>","actions":{"createCharacter":{"name":"","description":"","race":"","archetype":"","profession":"","startingRegion":"","strength":20,"dexterity":20,"intelligence":20,"constitution":20,"wisdom":20,"charisma":20,"maxHealth":100,"currentHealth":100,"maxMana":50,"currentMana":50,"raceAbilities":"","professionAbilities":"","armorType":"","level":1,"xp":1,"equippedWeapon":""},"createRace":{"id":"","name":"","abilities":""},"createProfession":{"id":"","name":"","abilities":""},"logEvent":{"type":"character_creation_start","details":{"character":"","startingRegion":""}}}}. Do NOT include any extra commentary outside JSON. Do NOT advance beyond asking for race. Wait for my race reply before any refinement.`;
    const initialCreationPrompt = `Begin character creation.`;
    pushMessage('🧙 The Creation Engine stirs... let us forge your identity.');
    void handleCharacterCreationLoopStreaming(initialCreationPrompt, getNextUserInput);
  }
});
</script>

<style lang="scss" scoped>
$input-area-height: 60px;
$toolbar-height: 60px;

.game-interface {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0; // ✨ important to allow inner flex children to shrink
  overflow: hidden;

  .chat-window {
    flex: 1 1 0; // ✨ allows shrinking
    min-height: 0; // ✨ prevents overflow growth
    overflow-y: auto; // only this scrolls
    background-color: #1c1c1c;
    padding: 1rem;
    box-sizing: border-box;
  }

  .chat-input-area {
    flex: 0 0 60px; // fixed height
    display: flex;
    align-items: center;
    padding: 0.5rem;
    background-color: #444;
    border-top: 1px solid #555;

    input.form-control {
      flex: 1;
      margin-right: 0.5rem;
    }

    button {
      min-width: 80px;
    }
  }

  .toolbar {
    flex: 0 0 60px; // fixed height
    display: flex;
    align-items: center;
    padding: 0.5rem;
    background-color: #333;
    border-top: 1px solid #555;

    .toolbar-icons {
      display: flex;
      gap: 0.5rem;

      button {
        width: 48px;
        height: 48px;
      }
    }
  }

  .travel-panel {
    position: absolute;
    top: 10%;
    left: 10%;
    right: 10%;
    bottom: 10%;
    background: #222;
    z-index: 1000;
  }
}


.loading-spinner {
  margin-top: 10px;
  font-style: italic;
  color: #888;
  animation: pulse 1.2s infinite;
}

@keyframes pulse {
  0% { opacity: 0.3; }
  50% { opacity: 1; }
  100% { opacity: 0.3; }
}

</style>
