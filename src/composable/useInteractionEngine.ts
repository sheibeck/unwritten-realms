// composables/useInteractionEngine.ts
import { ref } from 'vue';
import type { Quest, Npc } from '@/module_bindings';
import { useCharacterStore } from '@/stores/characterStore';

type Step =
  | null
  | 'awaitingQuestResponse'
  | 'awaitingCharacterStep'
  | 'awaitingVendorChoice'
  | 'awaitingFactionDecision';

interface InteractionContext {
  step: Step;
  quest?: Quest;
  npc?: Npc;
  threadId?: string;
}

export function useInteractionEngine() {
  const characterStore = useCharacterStore();

  const state = ref<InteractionContext | null>(null);

  function startQuestInteraction(quest: Quest, npc: Npc, threadId?: string) {
    state.value = {
      step: 'awaitingQuestResponse',
      quest,
      npc,
      threadId,
    };
  }

  function clear() {
    state.value = null;
  }

  function isAwaiting(step: Step): boolean {
    return state.value?.step === step;
  }

  async function handleQuestResponse(userInput: string) {
    const current = state.value;
    if (!current?.quest) return;

    const accepted = /yes|accept/i.test(userInput);

    await characterStore.logQuest({
      characterId: characterStore.character?.characterId,
      quests: [{
        questId: current.quest.questId,
        step: 0,
        status: accepted ? 'Active' : 'Refused',
      }]
    });

    clear();
    return accepted;
  }

  return {
    state,
    startQuestInteraction,
    clear,
    isAwaiting,
    handleQuestResponse,
  };
}
