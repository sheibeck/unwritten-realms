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
import { CreateAndLinkNewRegion, UpdateCharacterInput, type AddCharacterInput, type Region, type Quest, CharacterQuest, CreateNpcInput } from '../module_bindings/client';
import TravelPanel from './TravelPanel.vue';
import CharacterPanel from './CharacterPanel.vue';
import { useCharacterStore } from '@/stores/characterStore';
import { useQuestStore } from '@/stores/questStore';
import { useNpcStore } from '@/stores/npcStore';

const characterStore = useCharacterStore();
const questStore = useQuestStore();
const npcStore = useNpcStore();
const props = defineProps<{ character: any, currentRegion: any, linkedRegions: any }>();
const emit = defineEmits(['characterCreated', 'createAndLinkRegion', 'updateCharacter', 'createQuest']);

const messages = ref<{ raw: string; html: string }[]>([]);
const userInput = ref('');
const isLoading = ref(false);

// Resolver ref (set when waiting for next input)
let nextUserInputResolver: ((msg: string) => void) | null = null;
const chatContainer = ref<HTMLDivElement | null>(null);

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
}

const activeGameThreadId = ref<string | null>(null);

async function sendMessage(overrideMessage?: boolean = false, msg?: string = "", additionalData?: Record<string, any> = {}) {
  const message = overrideMessage ? msg : userInput.value.trim();
  
  if (!message) return;

  if (nextUserInputResolver) {
    // We are waiting in character creation loop → pass back user input
    nextUserInputResolver(message);
    nextUserInputResolver = null;
    userInput.value = '';
    return;
  }

  pushMessage(`🗨️ You: ${message}`);
  userInput.value = '';

  let action = '';
  if (message.toLowerCase() === ('awaken') && !hasActiveCharacter.value) {
    action = 'create-character';
  } 
  else if (message.toLocaleLowerCase().indexOf("traveling from") > -1 && overrideMessage) {
    action = 'travel';
  }
  else if (message.toLocaleLowerCase().indexOf("exploring from") > -1 && overrideMessage) {
    action = 'explore';
  }
  else if (message.toLocaleLowerCase() === "look") {
    action = 'look';
  }
  else {
    action = 'general-action';
  }

  try {
    switch (action) {
      case 'look':
        {
          pushMessage(`🧙 ${props.currentRegion.fullDescription}`);
        }
        break;
      case 'travel':
          {
            pushMessage(`🧙 ${additionalData.targetRegion.description}`);
            characterStore.setCurrentCharacterLocation(additionalData.targetRegion);
          }
          break;
      case 'explore':
          {
            const payload = buildPayload(action, message, additionalData);
            await handleRequest(action, payload);  
          }
          break;
      case 'create-character':
        {
          let currentMessage = message;

          while (!hasActiveCharacter.value) {
            const payload = buildPayload(action, currentMessage, additionalData);

            if (activeGameThreadId.value) {
              payload.threadId = activeGameThreadId.value;
            }

            await handleRequest(action, payload);

            if (!hasActiveCharacter.value) {
              currentMessage = await getNextUserInput();
              pushMessage(`🗨️ You: ${currentMessage}`);
            }
          }
        }
        break;
      default:
        {
          //WORLD ENGINE RESOLVER
          const payload = buildPayload(action, message, {
            ...buildContext()
          });

          if (activeGameThreadId.value) {
            payload.threadId = activeGameThreadId.value;
          }
          await handleRequest(action, payload);
        }
        break;
    }
  } catch (error) {
    console.error('Fetch error:', error);
    pushMessage(getErrorMessage());
  }

  await nextTick();
  scrollToBottom();
}

function buildContext() {
  const context = {
    "character": props.character,
    "region": props.currentRegion
  }

  delete context.character.userId;

  return context;
}

// Helper to handle API requests
async function handleRequest(action: string, payload: Record<string, any>) {
  const url = `/webhook/uwengine`;

  isLoading.value = true;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Origin': 'localhost' },
    body: JSON.stringify(payload),
  });

  isLoading.value = false;

  if (response.ok) {
    const result = await response.json();
    const assistantOutput = result[0].output || '';
    const jsonOutput = parseOutput(assistantOutput);

    pushMessage(`🧙 ${jsonOutput.narrative}`);

    if (jsonOutput.actions) {

      //output ai responses for debug
      for (const [key, value] of Object.entries(jsonOutput.actions)) {
        console.log(`AI Action: ${key}`);
        console.log("Value:", JSON.stringify(value, null, 2));
      }

      if (jsonOutput.actions.createCharacter) {
        const character: AddCharacterInput = jsonOutput.actions.createCharacter;

        const allPropsHaveValues = Object.values(character).every(value => value !== null && value !== undefined && value !== 0 && value !== "");

        if (allPropsHaveValues) {
          await addCharacter(character);
          hasActiveCharacter.value = true;
          newCharacter.value = true;
        }
      }
      
      if (jsonOutput.actions.createRegion) {
        const region: CreateAndLinkNewRegion = jsonOutput.actions.createRegion;
        region.fullDescription = jsonOutput.narrative;
        region.fromRegionId = props.character.currentLocation;
        region.travelEnergyCost = 100;
        await createAndLinkRegion(region);
      }

      if (jsonOutput.actions?.logEvent?.type.toLowerCase() === "arrival") {
        const character = { characterId: payload.characterId, currentLocation: payload.context.targetRegion.regionId };
        await updateCharacter(character as UpdateCharacterInput);
      }

      if (jsonOutput.actions.createQuest) {
        const quest: Quest = jsonOutput.actions.createQuest;
        quest.npcId = "";

        // 1. Create NPC if missing
        if (!quest.npcId) {
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
          };

          const createdNpc = await npcStore.createNpc(npcData as CreateNpcInput);
          quest.npcId = createdNpc.npcId;
          pushMessage(`🧙 NPC **${createdNpc.name}** has stepped forward to offer a quest.`);
        }

        // 2. Create the quest
        const finalQuest = await questStore.createQuest(quest);

        // 3. Confirm with player
        pushMessage(`🧙 Do you accept the quest: **${finalQuest.name}**? Type 'accept' to continue.`);

        const response = await getNextUserInput();

        if (response.toLowerCase().includes('accept')) {          
          const update = {
            characterId: props.character.characterId,
            quests: [{
              questId: finalQuest.questId,
              step: 0,
              status: 'active',
            } as CharacterQuest]
          };
          await updateCharacter(update as UpdateCharacterInput);
          pushMessage(`📜 Quest **${finalQuest.name}** has been added to your journal.`);
        } else {
          pushMessage(`🌀 The quest remains unclaimed.`);
        }
      }

      if (action === "general-action" || action === "create-character") {
        updateMainThread(result[0].threadId || activeGameThreadId.value);
      }
    }
  } else {
    pushMessage(getErrorMessage());
  }
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

async function addCharacter(characterData: AddCharacterInput) {
  console.debug('🚀 Emitting characterCreated event:', characterData);
  emit('characterCreated', characterData);

  pushMessage(`🎉 Character ${characterData.name} has been created!`);
}

async function createAndLinkRegion(data: CreateAndLinkNewRegion) {
  console.debug('🚀 Emitting createAndLinkRegion event:', data);
  emit('createAndLinkRegion', data);
  pushMessage(`🎉 Region ${data.name} has been created!`);
}

async function updateCharacter(data: UpdateCharacterInput) {
  console.debug('🚀 Emitting updateCharacter event:', data);
  emit('updateCharacter', data);
  pushMessage(`🎉 Character has been updated!`);
}

async function createQuest(data: Quest) {
  console.debug('🚀 Emitting updateQuest event:', data);
  emit('createQuest', data);
  pushMessage(`🎉 Quest has been created!`);
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

function buildPayload(action: string, messageContent: string, additionalData: Record<string, any> = {}): Record<string, any> {
  const payload: Record<string, any> = {
    action: action,
    message: messageContent,
    characterId: props.character.characterId,
    context: additionalData,
  };
  return payload;
}

onMounted(() => {
  activeGameThreadId.value = localStorage.getItem('unwrittenRealmsThreadId') ?? null;
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
