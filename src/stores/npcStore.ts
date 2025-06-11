import { defineStore } from "pinia";
import { computed, ref } from "vue";
import { useMainStore } from "./mainStore";

export const useNpcStore = defineStore('npcStore', () => {
  const npcs = ref<Map<string, Npc>>(new Map());
  const mainStore = useMainStore();
  const connection = computed(() => mainStore.connection);

  function initialize() {
    if (!connection.value) return;
    connection.value.db.npc.onInsert((_ctx, npc) => {
      const updated = new Map(npcs.value);
      updated.set(npc.npcId, npc);
      npcs.value = updated;
      console.debug('🌍 NPC inserted:', npc);
    });
  }

  function createNpc(data: CreateNpc): Promise<Npc> {
    return new Promise((resolve, reject) => {
      if (!connection.value) return;

      const builder = connection.value.subscriptionBuilder();
      const qid = builder.subscribe([`SELECT * FROM npc WHERE name = '${data.name}'`]);

      connection.value.db.npc.onInsert((_ctx, npc) => {
        if (npc.name === data.name) {
          resolve(npc);
          qid.unsubscribe();
        }
      });

      connection.value.reducers.createNpc(data.name, data.description, data.faction);

      setTimeout(() => reject('Timeout creating NPC'), 10000);
    });
  }

  return {
    initialize,
    createNpc,
  };
});
