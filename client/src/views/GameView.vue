<template>
  <div class="container">
    <div class="header">
      <div>
        <div class="eyebrow">Text MMORPG</div>
        <h1>Unwritten Realms</h1>
      </div>
      <div class="header-actions">
        <button class="btn ghost" type="button" @click="logout">Log out</button>
      </div>
    </div>
    <div class="events">
      <div v-for="e in events" :key="e.id" class="event">
        <span class="time">{{ new Date(e.timestamp).toLocaleTimeString() }}</span>
        <span class="text">{{ e.text }}</span>
      </div>
    </div>
    <form @submit.prevent="send" class="action-form">
      <input v-model="input" :disabled="loading" placeholder="Describe your action..." />
      <button type="submit" :disabled="loading || !input.trim()">
        <span v-if="!loading">Send</span>
        <span v-else>Processing...</span>
      </button>
    </form>

    <div class="toolbar">
      <button class="btn" @click="openViewCharacter" :disabled="!activeCharacter">View My Character</button>
      <button class="btn" @click="openCharacters">Characters</button>
      <button class="btn primary" @click="openWizard">Create Character</button>
    </div>

    <!-- Modals -->
    <div v-if="showCharacters" class="modal-backdrop" @click.self="closeModals">
      <div class="modal">
        <div class="modal-header">
          <h3>Your Characters</h3>
          <button @click="closeModals">Close</button>
        </div>
        <div v-if="characters.length === 0" class="no-characters">
          <p>You have no characters yet.</p>
          <button @click="openWizard">Create a Character</button>
        </div>
        <div v-else class="character-list">
          <div v-for="c in characters" :key="c.id" class="character-row">
            <div>
              <div class="char-name">{{ c.name }}</div>
              <div class="char-meta">{{ c.race || '' }} {{ c.archetype || '' }}</div>
            </div>
            <div class="char-actions">
              <button @click="setActive(c)">Play</button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div v-if="showViewCharacter && activeCharacter" class="modal-backdrop" @click.self="closeModals">
      <div class="modal">
        <div class="modal-header">
          <h3>Active Character</h3>
          <button @click="closeModals">Close</button>
        </div>
        <div class="char-detail">
          <div><strong>Name:</strong> {{ activeCharacter.name }}</div>
          <div><strong>Race:</strong> {{ activeCharacter.race }}</div>
          <div><strong>Archetype:</strong> {{ activeCharacter.archetype }}</div>
        </div>
      </div>
    </div>

    <div v-if="showWizard" class="modal-backdrop" @click.self="closeModals">
      <div class="modal modal-large">
        <div class="modal-header">
          <h3>Create Character</h3>
          <button @click="closeModals">Close</button>
        </div>
        <CharacterWizard />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { useRouter } from 'vue-router';
import { useGameStore } from '../store/game';
import { useAuthStore } from '../store/auth';
import { useCharactersStore } from '../store/characters';
import { useSpacetime } from '../composables/useSpacetime';
import { useNarrativeService } from '../composables/useNarrativeService';
import { useGoogleAuth } from '../composables/useGoogleAuth';
import CharacterWizard from './CharacterWizard.vue';

const router = useRouter();
const store = useGameStore();
const authStore = useAuthStore();
const charsStore = useCharactersStore();
const { connect, getDb, connected } = useSpacetime();
const { interpret, loading } = useNarrativeService();
const { signOut } = useGoogleAuth();

const input = ref('');
const events = computed(() => store.narrative_events);
const characters = computed(() => charsStore.characters);
const activeCharacter = computed(() => charsStore.activeCharacter);
const showCharacters = ref(false);
const showWizard = ref(false);
const showViewCharacter = ref(false);

onMounted(async () => {
  // Only connect if user is authenticated
  if (authStore.isAuthenticated && authStore.token) {
    await connect(authStore.token);
  } else {
    // Redirect to login if not authenticated
    router.push({ name: 'login' });
  }
});

async function send() {
  if (loading.value) return; // prevent spam while a request is in flight
  if (!input.value.trim()) return;
  const res = await interpret(input.value, { /* TODO */ }, { /* TODO */ });
  if (res?.intent) {
    // await applyIntent(res.intent);
  }
  if (res?.narrative_output) {
    store.addEvent({ id: String(Date.now()), text: res.narrative_output, timestamp: Date.now() });
  }
  input.value = '';
}

function openCharacters() {
  showCharacters.value = true;
  showWizard.value = false;
  showViewCharacter.value = false;
}
function openViewCharacter() {
  if (!activeCharacter.value) return;
  showViewCharacter.value = true;
  showCharacters.value = false;
  showWizard.value = false;
}
function openWizard() {
  showWizard.value = true;
  showCharacters.value = false;
  showViewCharacter.value = false;
}
function closeModals() {
  showCharacters.value = false;
  showWizard.value = false;
  showViewCharacter.value = false;
}
function setActive(c: any) {
  charsStore.setActiveCharacter(c);
  closeModals();
}

async function logout() {
  const emailHint = authStore.user?.email;
  await signOut();
  authStore.logout();
  router.push({ name: 'login' });
}
</script>

<style scoped>
.container { max-width: 800px; margin: 0 auto; padding: 24px; }
.header { display: flex; justify-content: space-between; align-items: center; gap: 12px; margin-bottom: 16px; }
.header-actions { display: flex; gap: 8px; }
.eyebrow { font-size: 12px; color: var(--muted); text-transform: uppercase; letter-spacing: 0.08em; }
.events { height: 320px; overflow: auto; border: 1px solid var(--border); margin-bottom: 12px; padding: 12px; background: #0b1220; border-radius: 8px; }
.event { display: flex; gap: 8px; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco; color: var(--text); padding: 6px 0; border-bottom: 1px solid rgba(255,255,255,0.05); }
.event:last-child { border-bottom: none; }
.time { color: var(--muted); min-width: 80px; }
.text { color: var(--text); }
.action-form { display: flex; gap: 10px; margin-bottom: 12px; }
.action-form input { flex: 1; padding: 10px 12px; background: #0f172a; border: 1px solid var(--border); color: var(--text); border-radius: 8px; }
.action-form button { padding: 10px 16px; border-radius: 8px; }
button[disabled] { opacity: 0.6; cursor: not-allowed; }
.toolbar { display: flex; gap: 10px; margin-bottom: 16px; flex-wrap: wrap; }
.modal-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,0.6); display: flex; align-items: center; justify-content: center; z-index: 50; }
.modal { background: var(--panel); padding: 16px; border: 1px solid var(--border); border-radius: 8px; width: 600px; max-height: 90vh; overflow: auto; }
.modal-large { width: 900px; }
.modal-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
.character-list { display: flex; flex-direction: column; gap: 8px; }
.character-row { display: flex; justify-content: space-between; padding: 8px; border: 1px solid var(--border); border-radius: 6px; }
.char-name { font-weight: 600; }
.char-meta { color: var(--muted); }
.char-actions { display: flex; gap: 8px; align-items: center; }
.char-detail div { margin: 4px 0; }
.btn { padding: 10px 14px; border-radius: 8px; background: #1f2937; color: var(--text); border: 1px solid var(--border); cursor: pointer; }
.btn.primary { background: #2563eb; border-color: #2563eb; color: #e2e8f0; }
.btn.ghost { background: transparent; border-color: var(--border); }
.btn:hover { filter: brightness(1.1); }
</style>
