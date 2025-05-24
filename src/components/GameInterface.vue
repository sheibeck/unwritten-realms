<template>
  <div class="game-interface">
    <!-- Main Chat / Play Area -->
    <div class="chat-window" ref="chatContainer">
      <div v-for="(msg, index) in messages" :key="index" class="chat-message">
        {{ msg }}
      </div>
    </div>

    <!-- Chat Input Area -->
    <div class="chat-input-area">
      <input
        v-model="userInput"
        @keyup.enter="sendMessage"
        class="form-control"
        type="text"
        placeholder="Type your command..."
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

const messages = ref<string[]>([
  '🌟 Welcome, adventurer!',
  'Type a command below to begin your journey...',
]);

const userInput = ref('');
const chatContainer = ref<HTMLDivElement | null>(null);

async function sendMessage() {
  const message = userInput.value.trim();
  if (!message) return;

  messages.value.push(`🗨️ You: ${message}`);

  try {
    const response = await fetch('https://YOUR_N8N_WEBHOOK_URL', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message }),
    });

    if (response.ok) {
      const result = await response.json();
      if (result.reply) {
        messages.value.push(`🤖 ${result.reply}`);
      } else {
        messages.value.push('✅ Command sent!');
      }
    } else {
      messages.value.push('❌ Failed to send message (server error).');
    }
  } catch (error) {
    console.error('Fetch error:', error);
    messages.value.push('❌ Failed to send message (network error).');
  }

  userInput.value = '';

  await nextTick();
  scrollToBottom();
}

function scrollToBottom() {
  if (chatContainer.value) {
    chatContainer.value.scrollTop = chatContainer.value.scrollHeight;
  }
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
    margin-bottom: calc(#{$input-area-height} + #{$toolbar-height}); // reserve space for fixed input + toolbar
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
    margin: 0; // outer margin removed; you can add inner spacing if desired
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

</style>
