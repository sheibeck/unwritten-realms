import { defineStore } from 'pinia';
import { ref, computed, watch } from 'vue';
import type {
  AddQuest,
  Quest,
} from '@/spacetimedb/client';
import { useMainStore } from './mainStore';

export const useQuestStore = defineStore('questStore', () => {
  const quests = ref<Map<string, Quest>>(new Map());
  // Track in-flight quest creations by composite key (npcId + name) to avoid duplicate reducer calls
  const pendingQuestKeys = ref<Set<string>>(new Set());
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

      // Escape single quotes in quest name for safe literal embedding
      const escapeSqlLiteral = (v: string) => v.replace(/'/g, "''");
      const compositeKey = `${data.npcId || ''}::${data.name}`;
      // If already created (by name) resolve immediately
      const existing = Array.from(quests.value.values()).find(q => q.name === data.name && q.npcId === data.npcId);
      if (existing) {
        return resolve(existing);
      }
      if (pendingQuestKeys.value.has(compositeKey)) {
        // Poll for its eventual presence instead of launching another reducer call
        const start = Date.now();
        const poll = setInterval(() => {
          const found = Array.from(quests.value.values()).find(q => q.name === data.name && q.npcId === data.npcId);
          if (found) { clearInterval(poll); resolve(found); }
          else if (Date.now() - start > 10000) { clearInterval(poll); reject('Timeout waiting for pending quest'); }
        }, 250);
        return;
      }
      pendingQuestKeys.value.add(compositeKey);

      const builder = connection.value.subscriptionBuilder();
      const safeName = escapeSqlLiteral(data.name);
      const qid = builder.subscribe([`SELECT * FROM quest WHERE name = '${safeName}'`]);

      const timeout = setTimeout(() => {
        qid.unsubscribe();
        pendingQuestKeys.value.delete(compositeKey);
        reject('Timeout creating Quest');
      }, 10000);

      connection.value.db.quest.onInsert((_ctx: any, quest: Quest) => {
        console.debug('🪄 Quest insert event received:', quest);
        if (quest.name === data.name && quest.npcId === data.npcId) {
          console.debug('✅ Matching quest found, resolving promise');
          clearTimeout(timeout);
          qid.unsubscribe();
          pendingQuestKeys.value.delete(compositeKey);
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

  const findQuestByName = (name: string, npcId?: string): Quest | undefined => {
    return Array.from(quests.value.values()).find(q => q.name === name && (npcId ? q.npcId === npcId : true));
  };

  return {
    initialize,
    createQuest,
    quests,
    findQuestByName
  };
});
