<template>
  <div class="container">
    <h2>Character Creation</h2>

    <div class="wizard">
      <div class="ai-prompt">
        <div v-if="loading">Thinking...</div>
        <div v-else class="ai-prompt-text" v-html="wizardHtml"></div>
      </div>

      <div class="options" v-if="options.length">
        <div v-for="(opt, idx) in options" :key="idx">
          <button :disabled="loading" @click="onSubmit(opt.name)">
            <div class="opt-title">{{ opt.name }}</div>
            <div v-if="opt && opt.description" class="opt-desc">{{ opt.description }}</div>
          </button>
        </div>
      </div>

        <div class="user-input">
          <input v-model="userText" :disabled="loading" placeholder="Type your reply here..." />
          <div class="actions">
            <button @click="onStartOver" :disabled="loading">Start Over</button>
            <button :disabled="loading" @click="() => { onSubmit(userText); userText = ''; }">Submit</button>
          </div>
        </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { useCharacterWizard } from '../composables/useCharacterWizard';
import { useRouter } from 'vue-router';
import MarkdownIt from 'markdown-it';
import DOMPurify from 'dompurify';

const router = useRouter();
const { step, name, race, archetype, profession, loading, error, generateProfession, reset, sessionId, wizardPrompt, options, data, startStep, submitStep } = useCharacterWizard();

const userText = ref('');

// Start the interactive wizard when the component mounts
onMounted(() => {
  startStep();
});

function onStartOver() {
  reset();
  startStep();
}

async function onSubmit(inputVal: string) {
  await submitStep(inputVal);
}

const md = new MarkdownIt({ html: false, linkify: true, typographer: true });
const wizardHtml = computed(() => DOMPurify.sanitize(md.render(wizardPrompt.value || '')));
</script>

<style scoped>
.container { max-width: 700px; margin: 24px auto; padding: 16px; background: var(--panel); border: 1px solid var(--border); }
label { display: block; margin-bottom: 6px; color: var(--muted); }
input { width: 100%; padding: 8px; margin-bottom: 12px; background: transparent; border: 1px solid var(--border); color: var(--text); }
.actions { display: flex; gap: 8px; margin-top: 12px; }
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
</style>
