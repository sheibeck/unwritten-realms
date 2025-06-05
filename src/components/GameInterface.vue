<template>
  <div class="game-interface">
    <!-- Main Chat / Play Area -->
    <div class="chat-window" ref="chatContainer">
     <div v-for="(msg, index) in messages" :key="index" class="message" v-html="msg.html"></div>
      <div v-if="isLoading" class="loading-spinner">
        ⏳ Waiting for response...
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
import { ref, nextTick } from 'vue';
import { marked } from 'marked';
import { CreateAndLinkNewRegion, UpdateCharacterInput, type AddCharacterInput, type Region } from '../module_bindings/client';
import TravelPanel from './TravelPanel.vue';
import CharacterPanel from './CharacterPanel.vue';

const props = defineProps<{ character: any, currentRegion: any, linkedRegions: any }>();
const emit = defineEmits(['characterCreated', 'createAndLinkRegion', 'updateCharacter']);

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

let threadId: string | null = localStorage.getItem('unwrittenRealmsThreadId') ?? null;

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
  if (message.toLowerCase() == ('awaken') && !hasActiveCharacter.value) {
    action = 'create-character';
  } 
  else if (message.toLocaleLowerCase().indexOf("traveling from") > -1) {
    action = 'travel';
  }
  else if (message.toLocaleLowerCase().indexOf("exploring from") > -1) {
    action = 'explore';
  }
  else {
    action = 'general-action';
  }

  const proxiedUrl = `/webhook/${action}`;

  try {
    switch (action) {
      case 'create-character':
        {
          let currentMessage = message;

          while (!hasActiveCharacter.value) {
            const payload = buildPayload(currentMessage, additionalData);
            await handleRequest(proxiedUrl, payload);

            if (!hasActiveCharacter.value) {
              currentMessage = await getNextUserInput();
              pushMessage(`🗨️ You: ${currentMessage}`);
            }
          }
        }
        break;
    case 'travel':
    case 'explore':
        {
          const payload = buildPayload(message, additionalData);
          await handleRequest(proxiedUrl, payload);  
        }
        break;
    default:
      {
        const payload = buildPayload(message, additionalData);
        await handleRequest(proxiedUrl, payload);
      }
      break;
    }
  } catch (error) {
    console.error('Fetch error:', error);
    pushMessage('❌ Failed to send message (network error).');
  }

  await nextTick();
  scrollToBottom();
}


// Helper to handle API requests
async function handleRequest(url: string, payload: Record<string, any>) {

  if (threadId) {
    //payload.threadId = threadId;
  }

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
    //threadId = result[0].threadId || threadId;

    if(threadId) {
      //localStorage.setItem('unwrittenRealmsThreadId', threadId);
    }

    const jsonOutput = parseOutput(assistantOutput);

    pushMessage(`🧙 ${jsonOutput.narrative}`);

    if (jsonOutput.actions) {
      if (jsonOutput.actions.createCharacter) {
        const character: AddCharacterInput = jsonOutput.actions.createCharacter;

        const allPropsHaveValues = Object.values(character).every(value => value !== null && value !== undefined && value !== 0 && value !== "");

        if (allPropsHaveValues) {
          addCharacter(character);
          hasActiveCharacter.value = true;
          newCharacter.value = true;
        }
      }
      
      if (jsonOutput.actions.createRegion) {
        const region: CreateAndLinkNewRegion = jsonOutput.actions.createRegion;
        region.fromRegionId = props.character.currentLocation;
        createAndLinkRegion(region);
      }

      if (jsonOutput.actions?.logEvent?.type.toLowerCase() === "arrival") {
        //const character: UpdateCharacterInput = jsonOutput.actions.updateCharacter;
        const character = { characterId: payload.characterId, currentLocation: payload.context.targetRegion.regionId };
        updateCharacter(character as UpdateCharacterInput);
      }
    }
  } else {
    pushMessage('❌ Failed to send message (server error).');
  }
}

async function pushMessage(message: string) {
  const html = await marked.parse(message);
  messages.value.push({ raw: `${message}`, html });

  await nextTick();
  scrollToBottom(); 
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
  console.log('🚀 Emitting characterCreated event:', characterData);
  emit('characterCreated', characterData);

  pushMessage(`🎉 Character ${characterData.name} has been created!`);
}

async function createAndLinkRegion(data: CreateAndLinkNewRegion) {
  console.log('🚀 Emitting createAndLinkRegion event:', data);
  emit('createAndLinkRegion', data);
  pushMessage(`🎉 Region ${data.name} has been created!`);
}

async function updateCharacter(data: UpdateCharacterInput) {
  console.log('🚀 Emitting updateCharacter event:', data);
  emit('updateCharacter', data);
  pushMessage(`🎉 Character has been updated!`);
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

function buildPayload(messageContent: string, additionalData: Record<string, any> = {}): Record<string, any> {
  const payload: Record<string, any> = {
    message: messageContent,
    characterId: props.character.characterId,
    context: additionalData,
  };
  return payload;
}
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
