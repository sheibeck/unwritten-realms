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
import { ref, nextTick, onMounted } from 'vue';
import { marked } from 'marked';
import { CreateAndLinkNewRegion, UpdateCharacter, type AddCharacter, type Region, type Quest, CreateNpc, Npc } from '@/spacetimedb/client';
import TravelPanel from './TravelPanel.vue';
import CharacterPanel from './CharacterPanel.vue';
import { useRegionStore } from '@/stores/regionStore';
import { useCharacterStore } from '@/stores/characterStore';
import { useQuestStore } from '@/stores/questStore';
import { useNpcStore } from '@/stores/npcStore';
import { useInteractionEngine } from '@/composables/useInteractionEngine';
// normalizeAction removed; use canonical action strings directly
import { useAssistantStream } from '@/composables/useAssistantStream';
import { shouldStream } from '@/engine/endpointPolicy';
import { emitPhase } from '@/engine/onboardingEvents';
import { useMainStore } from '@/stores/mainStore';

const interactionEngine = useInteractionEngine();
const regionStore = useRegionStore();
const characterStore = useCharacterStore();
const questStore = useQuestStore();
const npcStore = useNpcStore();
const mainStore = useMainStore();
const props = defineProps<{ character: any, currentRegion: any, linkedRegions: any }>();
const messages = ref<{ raw: string; html: string }[]>([]);
const userInput = ref('');
const isLoading = ref(false);
const isStreaming = ref(false);
const streamedBuffer = ref<string[]>([]);
const { startStream } = useAssistantStream();

// Resolver ref (set when waiting for next input)
const chatContainer = ref<HTMLDivElement | null>(null);
let nextUserInputResolver: ((msg: string) => void) | null = null;

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
  pushMessage('Type `Awaken` to forge your destiny and begin your journey.');
  emitPhase('INITIATION', mainStore.currentUserId || null);
}

const activeGameThreadId = ref<string | null>(null);

// Streamlined sendMessage function with local, interaction, and AI delegation
async function sendMessage(overrideMessage = false, msg = '', additionalData: Record<string, any> = {}) {
  const message = overrideMessage ? msg : userInput.value.trim();
  if (!message) return;

  // Character creation loop awaiting raw user input
  if (nextUserInputResolver) {
    nextUserInputResolver(message);
    nextUserInputResolver = null;
    userInput.value = '';
    return;
  }

  // Step 1: Handle interaction response if mid-conversation
  if (interactionEngine.isAwaiting('awaitingQuestResponse')) {
    const accepted = await interactionEngine.handleQuestResponse(message);
    if (accepted) {
      pushMessage(`📜 Quest accepted.`);
    } else {
      pushMessage(`🌀 Quest declined.`);
    }
    userInput.value = '';
    return;
  }

  // Step 2: Display user message
  pushMessage(`🗨️ You: ${message}`);
  userInput.value = '';

  // Step 3: Route local commands
  const action = resolveLocalAction(message, overrideMessage);

  if (action === 'look') {
    pushMessage(`🧙 ${props.currentRegion.fullDescription}`);
    return;
  }

  if (action === 'travel') {
    pushMessage(`🧙 ${additionalData.targetRegion.description}`);
    characterStore.setCurrentCharacterLocation(additionalData.targetRegion);
    return;
  }

  // Step 4: Handle AI-integrated commands
  if (action === 'character.create') {
    await handleCharacterCreationLoopStreaming(message, getNextUserInput, updateMainThread);
    return;
  }

  // Default AI interaction (explore/general-action) with policy-based streaming vs single-run
  if (['region.create', 'world.general'].includes(action)) {
    const normalized = action; // already canonical
    const payload = buildPayload(action, message, { ...buildContext(), ...additionalData });
    if (activeGameThreadId.value) payload.threadId = activeGameThreadId.value;

    // Decide path
    if (shouldStream(normalized)) {
      isStreaming.value = true;
      streamedBuffer.value = [];
      const narrativeChunks: string[] = [];

      await startStream({
        message: payload.message,
        action: normalized,
        context: payload.context,
        threadId: payload.threadId,
        onChunk: async (text) => {
          // Try to parse; if structured with narrative show that, else raw text
          let parsed: any; try { parsed = JSON.parse(text); } catch { parsed = null; }
          if (parsed?.narrative) {
            narrativeChunks.push(parsed.narrative);
            await pushMessage(`🧙 ${parsed.narrative}`);
          } else {
            narrativeChunks.push(text);
            await pushMessage(`🧙 ${text}`);
          }
        },
        onResult: async (res) => {
          // Final structured outputs from server; hand off directly
          isStreaming.value = false;
          await handleAiResponse(res, action);
          await nextTick();
          scrollToBottom();
        },
        onDone: async () => {
          // done arrives after result; nothing additional required
        },
        onError: async (err) => {
          if (err === 'aborted') return;
          console.error('Stream error:', err);
          isStreaming.value = false;
          // Fallback to single-run
          try {
            isLoading.value = true;
            const response = await fetch('/assistant/run', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Origin': 'localhost' },
              body: JSON.stringify({ message: payload.message, action: normalized, context: payload.context, threadId: payload.threadId, auto: false })
            });
            isLoading.value = false;
            if (response.ok) {
              const result = await response.json();
              await handleAiResponse(result, action);
            } else {
              pushMessage(getErrorMessage());
            }
          } catch (e) {
            isLoading.value = false;
            console.error('Fallback fetch error:', e);
            pushMessage(getErrorMessage());
          }
        }
      });
    } else {
      // Non-stream path
      try {
        isLoading.value = true;
        const response = await fetch('/assistant/run', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Origin': 'localhost' },
          body: JSON.stringify({ message: payload.message, action: normalized, context: payload.context, threadId: payload.threadId, auto: false })
        });
        isLoading.value = false;
        if (response.ok) {
          const result = await response.json();
          await handleAiResponse(result, action);
          await nextTick();
          scrollToBottom();
        } else {
          pushMessage(getErrorMessage());
        }
      } catch (e) {
        isLoading.value = false;
        console.error('Run endpoint error:', e);
        pushMessage(getErrorMessage());
      }
    }
  }
}

// Resolves local commands like 'look', 'travel', 'explore', or fallback to 'general-action'
function resolveLocalAction(message: string, isOverride = false): string {
  const lower = message.toLowerCase();
  if (lower === 'look') return 'look';
  if (isOverride && lower.includes('traveling from')) return 'travel.move';
  if (isOverride && lower.includes('exploring from')) return 'region.create';
  if (lower === 'awaken' && !characterStore.currentCharacter) return 'character.create';
  return 'world.general';
}

// Builds a sanitized context object to pass to the AI payload
function buildContext(): Record<string, any> {
  const ctx = {
    character: { ...props.character },
    region: props.currentRegion,
    npcs: Array.from(npcStore.npcs.values()),     // ✅ array of Npc
    quests: Array.from(questStore.quests.values()) // ✅ array of Quest
  };

  //remove sensitive/unused information
  delete ctx.character.userId;
  return ctx;
}

async function pushMessage(message: string) {
  const html = await marked.parse(message);
  messages.value.push({ raw: `${message}`, html });

  await nextTick();
  scrollToBottom(); 
}

function updateMainThread(threadId: string) {
  if(threadId) {
    localStorage.setItem('unwrittenRealmsThreadId', threadId);
  }
  activeGameThreadId.value = threadId;
}

function parseOutput(output: string) {
  const json = JSON.parse(output);
  return json;
}

// Waits for next user input during loop
function getNextUserInput(): Promise<string> {
  return new Promise((resolve) => {
    nextUserInputResolver = resolve;
  });
}

const chatInput = ref<HTMLInputElement | null>(null);

function scrollToBottom() {
  nextTick(() => {
    if (chatContainer.value) {
      chatContainer.value.scrollTo({
        top: chatContainer.value.scrollHeight,
        behavior: 'smooth', // ✨ makes the scroll animate!
      });
    }
    if (chatInput.value) {
      chatInput.value.focus();
    }
  });
}

async function handleCharacterCreationLoopStreaming(initialMessage: string, getNextUserInput: () => Promise<string>, updateMainThread: Function) {
  let currentMessage = initialMessage;
  let iteration = 0;
  let threadId: string | null = activeGameThreadId.value;

  while (!characterStore.currentCharacter?.characterId) {
    emitPhase(iteration === 0 ? 'CONCEPT' : 'REFINEMENT', mainStore.currentUserId || null, { iteration });

    // Capture final structured output via result event
    let finalJson: any = null;

    await startStream({
      message: currentMessage,
      action: 'character.create',
      threadId: threadId,
      context: buildContext(),
      onMeta: (m) => { threadId = m.threadId; },
      onChunk: async (text) => {
        // Display narrative as it streams
        let parsed: any; try { parsed = JSON.parse(text); } catch { parsed = null; }
        if (parsed?.narrative) {
          await pushMessage(`🧙 ${parsed.narrative}`);
          finalJson = parsed; // keep latest structured
        } else {
          await pushMessage(`🧙 ${text}`);
        }
      },
      onResult: async (res) => {
        // Parse final output array
        const last = res.output[res.output.length - 1] || '{}';
        let parsed: any; try { parsed = JSON.parse(last); } catch { parsed = { narrative: last }; }
        finalJson = parsed;
        if (finalJson.actions?.createCharacter) {
          const character = finalJson.actions.createCharacter as AddCharacter;
          const complete = Object.values(character).every(v => v !== null && v !== undefined && v !== 0 && v !== '');
          if (complete) {
            emitPhase('CONFIRMATION', mainStore.currentUserId || null);
            await addCharacter(character);
            const charId = (character as any).characterId || (character as any).id || null;
            emitPhase('PERSISTENCE', mainStore.currentUserId || null, { characterId: charId });
            updateMainThread(res.threadId);
          }
        }
      },
      onDone: async () => {
        // No additional logic needed; actions handled in onResult
      },
      onError: async (err) => {
        if (err === 'aborted') return;
        console.error('Character creation stream error:', err);
        pushMessage(getErrorMessage());
        emitPhase('ERROR', mainStore.currentUserId || null, { reason: 'character_creation_stream_failed' });
      }
    });

    if (characterStore.currentCharacter?.characterId) break; // completed

    currentMessage = await getNextUserInput();
    await pushMessage(`🗨️ You: ${currentMessage}`);
    iteration++;
  }
}

async function addCharacter(characterData: AddCharacter) {
  await characterStore.addCharacter(characterData);
  await pushMessage(`🎉 Character ${characterData.name} has been created!`);
}

async function createAndLinkRegion(data: CreateAndLinkNewRegion) {
  console.debug('⚡ Region created event received:', data);
  const newRegion = await regionStore.createAndLinkNewRegion(data); // ✅ updated

  //move character to new region
  await characterStore.setCurrentCharacterLocation(newRegion);

  pushMessage(`🎉 Region ${data.name} has been created!`);
}

async function updateCharacter(data: UpdateCharacter) {
  console.debug('⚡ Character updated event received:', data);
  await characterStore.updateCharacter(data);
  pushMessage(`🎉 Character has been updated!`);
}

function getLoadingMessage(): string {
  const messages: string[] = [
    "Arcane currents shift as your will takes form",
    "The aether hums as your intent ripples through the weave",
    "The winds of fate pause, awaiting your decree",
    "The realm holds its breath for your command"
  ];
  return `⏳ ${messages[Math.floor(Math.random() * messages.length)]}...`;
}

function getErrorMessage(): string {
  const messages: string[] = [
    "The Ripple falters. Your words were lost to the shadow. Cast them once more into the stream",
    "A rift in the weave sundered your message. Resend it to breach the veil",
    "The lattice glitched—your message vanished into the void. Try again, wanderer"
  ];
  return `❌ ${messages[Math.floor(Math.random() * messages.length)]}`;
}

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

function buildPayload(
  action: string,
  messageContent: string,
  additionalData: Record<string, any> = {}
): Record<string, any> {
  const payload: Record<string, any> = {
    action,
    message: messageContent,
    characterId: props.character?.characterId ?? null,
    context: additionalData,
  };
  return payload;
}

async function handleAiResponse(response: any, originalAction: string) {
  const assistantOutputArr: string[] = response.output || [];
  const assistantOutput = assistantOutputArr[assistantOutputArr.length - 1] || '';
  const jsonOutput = parseOutput(assistantOutput);

  pushMessage(`🧙 ${jsonOutput.narrative}`);

  if (!jsonOutput.actions) return;

  //Log AI generatd actions
  for (const [key, value] of Object.entries(jsonOutput.actions)) {
    console.log(`AI Action: ${key}`);
    console.log("Value:", JSON.stringify(value, null, 2));
  }

  // Handle character creation
  if (jsonOutput.actions.createCharacter) {
    const character: AddCharacter = jsonOutput.actions.createCharacter;
    const allPropsHaveValues = Object.values(character).every(v => v !== null && v !== undefined && v !== 0 && v !== "");
    if (allPropsHaveValues) {
      await addCharacter(character);
      hasActiveCharacter.value = true;
      newCharacter.value = true;
    }
  }

  // Handle region creation
  if (jsonOutput.actions.createRegion) {
    const region: CreateAndLinkNewRegion = jsonOutput.actions.createRegion;
    region.fullDescription = jsonOutput.narrative;
    region.fromRegionId = props.character.currentLocation;
    region.travelEnergyCost = 100;
    await createAndLinkRegion(region);
  }

  if (jsonOutput.actions.createNpc) {
    const newNpc: CreateNpc = jsonOutput.actions.createNpc;
    newNpc.regionId = regionStore.currentRegion?.regionId ?? "";
    const createdNpc: Npc = await npcStore.createNpc(newNpc);
    pushMessage(`🧙 A new NPC has emerged: **${createdNpc.name}**.`);
  }

  // Handle arrival logging
  if (jsonOutput.actions?.logEvent?.type?.toLowerCase() === "arrival") {
    const update = { characterId: props.character.characterId, currentLocation: jsonOutput.actions.logEvent.locationId };
    await updateCharacter(update as UpdateCharacter);
  emitPhase('ARRIVAL_DESCRIBE', mainStore.currentUserId || null, { locationId: jsonOutput.actions.logEvent.locationId });
  }

  // Handle quest creation with interaction engine
  if (jsonOutput.actions.createQuest) {
    const quest: Quest = jsonOutput.actions.createQuest;
    let npc = await npcStore.findNpcById?.(quest.npcId);
    const finalQuest = await questStore.createQuest(quest);

  interactionEngine.startQuestInteraction(finalQuest, npc, response.threadId);
    pushMessage(`🧙 ${npc?.name} offers you a quest: \"${quest.name}\". Do you accept?`);
  }

  if (jsonOutput.actions.updateCharacter) {
    const update = jsonOutput.actions.updateCharacter;
    await updateCharacter(update as UpdateCharacter);
  }

  // Thread tracking
  if (originalAction === "general-action" || originalAction === "create-character") {
    updateMainThread(response.threadId || activeGameThreadId.value);
  }
}

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
  activeGameThreadId.value = localStorage.getItem('unwrittenRealmsThreadId') ?? null;
  emitPhase('AUTH', mainStore.currentUserId || null);
  emitPhase('CHECK_CHARACTER', mainStore.currentUserId || null, { hasCharacter: !!props.character });
})
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
