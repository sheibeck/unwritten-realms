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
        @keyup.enter="sendMessage"
        class="form-control"
        type="text"
        placeholder="Type your command..."
        :disabled="isLoading"
      />
      <button class="btn btn-primary" @click="sendMessage">Send</button>
    </div>

    <!-- Fixed Bottom Toolbar -->
    <div class="toolbar">
      <div class="toolbar-icons">
        <button class="btn btn-dark" @click="showCharacter" title="Character">
          <i class="bi bi-person-fill"></i>
        </button>
        <button class="btn btn-dark" @click="showQuests" title="Quests">
          <i class="bi bi-journal-text"></i>
        </button>
        <button class="btn btn-dark" @click="showFactions" title="Factions">
          <i class="bi bi-people-fill"></i>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, nextTick } from 'vue';
import { marked } from 'marked';

const props = defineProps<{ character: any }>();
const emit = defineEmits(['characterCreated']);

const messages = ref<{ raw: string; html: string }[]>([]);
const userInput = ref('');
const isLoading = ref(false);

// Resolver ref (set when waiting for next input)
let nextUserInputResolver: ((msg: string) => void) | null = null;
const chatContainer = ref<HTMLDivElement | null>(null);
const scrollAnchor = ref<HTMLDivElement | null>(null);

if (props.character) {
  pushMessage(`🌟 Welcome back, ${props.character.name}!`);
  pushMessage(`The realms stir with possibility — what adventure will you spark next?`);
} else {
  pushMessage('✨ Welcome, brave soul, to Unwritten Worlds!');
  pushMessage('Your story has yet to be inked across the stars.');
  pushMessage('Type `Awaken` to forge your destiny and begin your journey.');
}

let threadId: string | null = localStorage.getItem('characterThreadId') ?? null;

let characterCreated = false;

async function sendMessage() {
  const message = userInput.value.trim();
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
  if (message.toLowerCase() == ('awaken') && !characterCreated) {
    action = 'create-character';
  } else {
    action = 'general-action';
  }

  const proxiedUrl = `/webhook/${action}`;

  try {
    if (action === 'create-character') {
      let currentMessage = message;

      while (!characterCreated) {
        await handleRequest(proxiedUrl, currentMessage);

        if (!characterCreated) {
          currentMessage = await getNextUserInput();
          pushMessage(`🗨️ You: ${currentMessage}`);
        }
      }
    } else {
      await handleRequest(proxiedUrl, message);
    }
  } catch (error) {
    console.error('Fetch error:', error);
    pushMessage('❌ Failed to send message (network error).');
  }

  await nextTick();
  scrollToBottom();
}


// Helper to handle API requests
async function handleRequest(url: string, messageContent: string) {
  const payload: Record<string, any> = { message: messageContent };
  if (threadId) {
    payload.threadId = threadId;
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
    threadId = result[0].threadId || threadId;

    if(threadId) {
      localStorage.setItem('characterThreadIdId', threadId);
    }

    const jsonOutput = parseOutput(assistantOutput);

    pushMessage(`🧙 ${jsonOutput.narrative}`);

    if (jsonOutput.actions) {
      if (jsonOutput.actions && jsonOutput.actions.createCharacter) {
      const character = jsonOutput.actions.createCharacter;

      const hasAllValues = character.id &&
                          character.name &&
                          character.race &&
                          character.profession &&
                          character.specialization &&
                          character.startingRegionId;

      if (hasAllValues) {
        AddCharacter(character);
        characterCreated = true;
      }
    }

      // You can handle other actions here too:
      // if (jsonOutput.actions.logEvent) { ... }
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
      chatContainer.value.scrollTop = chatContainer.value.scrollHeight;
    }
    if (chatInput.value) {
      chatInput.value.focus();
    }
  });
}

function showCharacter() {
  console.log('Character details opened');
}

function showQuests() {
  console.log('Quest log opened');
}

function showFactions() {
  console.log('Faction standings opened');
}

async function AddCharacter(characterData: any) {
  console.log('🚀 Emitting characterCreated event:', characterData);
  emit('characterCreated', characterData);

  pushMessage(`🎉 Character ${characterData.name} has been created!`);
}
</script>

<style lang="scss" scoped>
$input-area-height: 60px;
$toolbar-height: 60px;

.game-interface {
  position: relative;
  flex: 1; // fills parent
  display: flex;
  flex-direction: column;

  .chat-window {
    flex: 1;
    overflow-y: auto;
    background-color: #1c1c1c;
    color: #f8f9fa;
    font-family: monospace;
    padding: 1rem;

    // Reserve space so content doesn’t disappear under fixed bottom bars
    padding-bottom: calc(#{$input-area-height} + #{$toolbar-height});
    box-sizing: border-box;
  }

  .chat-input-area {
    position: fixed;
    bottom: $toolbar-height; // sit right above toolbar
    left: 0;
    width: 100%;
    height: $input-area-height;
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
    position: fixed;
    bottom: 0;
    left: 0;
    width: 100%;
    height: $toolbar-height;
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
