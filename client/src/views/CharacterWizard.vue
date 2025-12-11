<template>
  <div class="container">
    <h2>Character Creation</h2>

    <div class="wizard">
      <div class="ai-prompt">
        <div v-if="loading">Thinking...</div>
        <div v-else class="ai-prompt-text" v-html="wizardHtml"></div>
      </div>

      <div class="options" v-if="!saved && options.length && stepId !== 'profession_preview'">
        <div v-for="(opt, idx) in options" :key="idx">
          <button :disabled="loading" @click="onSelect(opt)">
            <div class="opt-title">{{ opt.name }}</div>
            <div v-if="opt && opt.description" class="opt-desc">{{ opt.description }}</div>
          </button>
        </div>
      </div>

      <div v-if="preview" class="preview-card">
        <div class="preview-header">
          <div class="opt-title">{{ preview.name }}</div>
          <div class="opt-desc">{{ preview.lore }}</div>
        </div>
        <pre v-if="preview.mechanics">{{ JSON.stringify(preview.mechanics, null, 2) }}</pre>
        <div v-if="stepId === 'profession_preview' && preview.abilities && preview.abilities.length">
          <strong>Abilities:</strong>
          <ul>
            <li v-for="(ab, i) in preview.abilities" :key="i">{{ ab }}</li>
          </ul>
        </div>
        <div v-if="preview.starterWeapon"><strong>Starter Weapon:</strong> {{ preview.starterWeapon }}</div>
        <button v-if="stepId === 'profession_preview'" class="lock-btn" :disabled="loading" @click="onLock">Accept profession</button>
      </div>

      <div class="user-input">
        <input v-model="userText" :disabled="loading" placeholder="Chat about this step or enter a value" />
        <div class="actions">
          <button @click="onStartOver" :disabled="loading" title="Starting over may generate different options">Start Over</button>
          <button v-if="stepId === 'profession_preview'" disabled title="Only one profession is available for this run">Only one profession per run</button>
          <button :disabled="loading" @click="onAsk">Ask</button>
          <button :disabled="loading || (stepId !== 'name' && !stagedSelection && !preview)" class="lock-btn" @click="onLock">
            Lock and continue
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { useCharacterWizard } from '../composables/useCharacterWizard';
import { useSpacetime } from '../composables/useSpacetime';
import MarkdownIt from 'markdown-it';
import DOMPurify from 'dompurify';

const { stepId, wizardPrompt, options, preview, loading, error, sessionId, context, startOver, assist, lock } = useCharacterWizard();
const { getConnection } = useSpacetime();

const userText = ref('');
const stagedSelection = ref<string>('');
const saved = ref(false);

// Start the interactive wizard when the component mounts
onMounted(() => {
  startOver();

  getConnection().reducers.onCreateCharacter((e: any) => {
    console.log('Character created!');
  });
});

function onStartOver() {
  stagedSelection.value = '';
  userText.value = '';
  saved.value = false;
  startOver();
}

async function onSelect(opt: any) {
  const val = opt?.value || opt?.name;
  stagedSelection.value = val;
  // Summary step: handle locally (confirm/save or start over) without re-hitting the AI
  if (stepId.value === 'summary') {
    if (val && val.toLowerCase().includes('start')) {
      await onStartOver();
    } else if (val && val.toLowerCase().includes('confirm')) {
      try {
        await persistCharacter();
        wizardPrompt.value = 'Character saved. You are ready to enter the world.';
        options.value = [];
        preview.value = null;
      }
      catch(e) {
        console.warn('Failed to save character to SpacetimeDB', e);
        saved.value = false;
      }
    }
    stagedSelection.value = '';
    userText.value = '';
    return;
  }
  // Single call to lock and advance; no double-submit
  await lock(val);
  stagedSelection.value = '';
  userText.value = '';
}

async function onAsk() {
  const text = userText.value;
  userText.value = '';
  await assist(text);
}

async function persistCharacter() {
  try {
    const conn = getConnection();
    if (!conn) throw new Error('not_connected');
    const ctx = context.value || {};
    const payload = {
      id: `${Date.now()}`,
      name: ctx.name || '',
      race: ctx.race || '',
      archetype: ctx.archetype || '',
      profession_json: JSON.stringify(ctx.profession || preview.value || {}),
      stats_json: JSON.stringify(ctx.stats || {})
    };
    await conn.reducers.createCharacter(payload);
    saved.value = true;
  } catch (e) {
    console.warn('Failed to save character to SpacetimeDB', e);
    saved.value = false;
  }
}

async function onLock() {
  const val = stepId.value === 'name' ? userText.value : stagedSelection.value;
  if (stepId.value === 'name' && !val && !preview.value) return;
  if (stepId.value === 'summary') {
    await persistCharacter();
    wizardPrompt.value = 'Character saved. You are ready to enter the world.';
    options.value = [];
    preview.value = null;
    stagedSelection.value = '';
    userText.value = '';
    return;
  }
  await lock(val || (preview.value ? preview.value.name : ''));
  stagedSelection.value = '';
  userText.value = '';
}

const md = new MarkdownIt({ html: false, linkify: true, typographer: true });
const wizardHtml = computed(() => DOMPurify.sanitize(md.render(wizardPrompt.value || '')));
</script>

<style scoped>
.container { max-width: 700px; margin: 24px auto; padding: 16px; background: var(--panel); border: 1px solid var(--border); }
label { display: block; margin-bottom: 6px; color: var(--muted); }
input { width: 100%; padding: 8px; margin-bottom: 12px; background: transparent; border: 1px solid var(--border); color: var(--text); }
.actions { display: flex; gap: 8px; margin-top: 12px; flex-wrap: wrap; }
 button { padding: 8px 12px; background: var(--accent); border: none; color: #031124; border-radius: 6px; cursor: pointer; }
 .options button { cursor: pointer; }
 .options { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin: 12px 0; }
 .options button { text-align: left; padding: 10px; background: var(--panel); color: var(--text); border: 1px solid var(--border); }
 .opt-title { font-weight: 600; }
 .opt-desc { font-size: 0.9em; color: var(--muted); margin-top: 4px; }
 .ai-prompt-text { white-space: pre-wrap; line-height: 1.4; }
 .ai-prompt-text h1, .ai-prompt-text h2, .ai-prompt-text h3 { margin: 8px 0; }
 .ai-prompt-text p { margin: 6px 0; }
 .ai-prompt-text ul { margin: 6px 0 6px 18px; }
 .ai-prompt-text code { background: rgba(255,255,255,0.03); padding: 2px 4px; border-radius: 4px; }
 .ai-prompt-text pre { background: rgba(0,0,0,0.25); padding: 10px; border-radius: 6px; overflow: auto; }
 button:disabled { opacity: 0.5; cursor: not-allowed; }
 input:disabled { opacity: 0.6; }
button[disabled] { opacity: 0.6; cursor: not-allowed; }
pre { background: rgba(255,255,255,0.02); padding: 8px; color: var(--text); }
.preview-card { border: 1px solid var(--border); padding: 12px; border-radius: 8px; margin: 12px 0; background: var(--panel); }
.preview-header { margin-bottom: 8px; }
.lock-btn { background: #4ade80; color: #031124; }
</style>
