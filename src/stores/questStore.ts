import { defineStore } from 'pinia';
import { ref, computed, watch } from 'vue';
import type {
  AddQuest,
  Quest,
} from '@/spacetimedb/client';
import { useMainStore } from './mainStore';

export const useQuestStore = defineStore('questStore', () => {
  const quests = ref<Map<string, Quest>>(new Map());
  const mainStore = useMainStore();
  const connection = computed(() => mainStore.connection);

  function initialize() {
    if (!connection.value) {
      console.warn('No connection provided to questStore');
      return;
    }

    // Setup event listeners
    connection.value.db.quest.onInsert((_ctx: any, quest: Quest) => {
      const updated = new Map(quests.value);
      updated.set(quest.questId, quest);
      quests.value = updated;
      console.debug('🌍 New quest inserted:', quest);
    });

    connection.value.db.quest.onUpdate((_ctx: any, oldQuest: Quest, newQuest: Quest) => {
      const updated = new Map(quests.value);
      updated.delete(oldQuest.questId);
      updated.set(newQuest.questId, newQuest);
      quests.value = updated;
      console.debug('🌍 Quest updated:', newQuest);
    });

    connection.value.db.quest.onDelete((_ctx: any, quest: Quest) => {
      const updated = new Map(quests.value);
      updated.delete(quest.questId);
      quests.value = updated;
      console.debug('🌍 Quest deleted:', quest);
    });
  }

  // Watch for connection becoming available and initialize automatically
  watch(
    () => connection.value,
    (conn) => {
      if (conn) initialize();
    },
    { immediate: true }
  );

  // Returns the fully created Quest (with questId) once inserted
  function createQuest(data: AddQuest): Promise<Quest> {
    return new Promise((resolve, reject) => {
      if (!connection.value) {
        console.warn('No active SpaceTimeDB connection');
        return;
      }

      const builder = connection.value.subscriptionBuilder();
      const qid = builder.subscribe([`SELECT * FROM quest WHERE name = '${data.name}'`]);

      const timeout = setTimeout(() => {
        qid.unsubscribe();
        reject('Timeout creating Quest');
      }, 10000);

  connection.value.db.quest.onInsert((_ctx: any, quest: Quest) => {
        console.debug('🪄 Quest insert event received:', quest);

        if (quest.name === data.name) {
          console.debug('✅ Matching quest found, resolving promise');
          clearTimeout(timeout);
          qid.unsubscribe();
          resolve(quest);
        }
      });

      connection.value.reducers.addQuest(
        data.npcId,
        data.name,
        data.description,
        data.steps,
        data.reward,
        data.penalty,
        data.type,
        data.repeatable
      );
    });
  }

  return {
    initialize,
    createQuest,
    quests
  };
});
