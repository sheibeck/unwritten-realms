import { defineStore } from "pinia";
import { computed, ref } from "vue";
import { useMainStore } from "./mainStore";
import type { Npc, CreateNpc } from '../spacetimedb';

export const useNpcStore = defineStore('npcStore', () => {
  const npcs = ref<Map<string, Npc>>(new Map());
  const mainStore = useMainStore();
  const connection = computed(() => mainStore.connection);

  function initialize() {
    if (!connection.value) return;

  connection.value.db.npc.onInsert((_ctx: any, npc: Npc) => {
      const updated = new Map(npcs.value);
      updated.set(npc.npcId, npc);
      npcs.value = updated;
      console.debug('🌍 NPC inserted:', npc);
    });

  connection.value.db.npc.onUpdate((_ctx: any, npc: Npc) => {
      const updated = new Map(npcs.value);
      updated.set(npc.npcId, npc);
      npcs.value = updated;
      console.debug('🌍 NPC updated:', npc);
    });

  connection.value.db.npc.onDelete((_ctx: any, npc: Npc) => {
      const updated = new Map(npcs.value);
      updated.set(npc.npcId, npc);
      npcs.value = updated;
      console.debug('🌍 NPC deleted:', npc);
    });
  }

  async function createNpc(data: CreateNpc): Promise<Npc> {
    return new Promise((resolve, reject) => {
      if (!connection.value) return;

      const builder = connection.value.subscriptionBuilder();
      const qid = builder.subscribe([`SELECT * FROM npc WHERE name = '${data.name}'`]);

      const timeout = setTimeout(() => {
        qid.unsubscribe();
        reject('Timeout creating NPC');
      }, 10000);

  connection.value.db.npc.onInsert((_ctx: any, npc: Npc) => {
        if (npc.name === data.name) {
          clearTimeout(timeout); // ✅ Cancel timeout
          qid.unsubscribe();
          resolve(npc);
        }
      });

      connection.value.reducers.createNpc(
        data.name,
        data.description,
        data.race,
        data.profession,
        data.maxHealth,
        data.currentHealth,
        data.maxMana,
        data.currentMana,
        data.abilities,
        data.regionId
      );
    });
  }

  const findNpcById = (id: string): Npc | undefined => {
    return npcs.value.get(id);
  };

  const findNpcByName = (name: string): Npc | undefined => {
    return Array.from(npcs.value.values()).find((npc: Npc) => {
      return npc.name === name;
    });
  };

  return {
    initialize,
    createNpc,
    findNpcById,
    findNpcByName,
    npcs
  };
});
