import { defineStore } from 'pinia';
import { ref, shallowRef } from 'vue';
import type {
  Character,
  AddCharacterInput,
  UpdateCharacterInput,
  Region
} from '../module_bindings/client';
import { useMainStore } from './mainStore';
import { useRegionStore } from './regionStore';
import { emitPhase } from '@/engine/onboardingEvents';
import type { DbConnection } from '../module_bindings/client';

export const useCharacterStore = defineStore('characterStore', () => {
  const characters = ref<Map<string, Character>>(new Map());
  const currentCharacter = shallowRef<Character | null>();
  const mainStore = useMainStore();
  const regionStore = useRegionStore();
  // Direct reference to mainStore SpaceTime connection ref (force ref shape)
  interface ConnectionRef { value: DbConnection | null }
  const connection = mainStore.connection as unknown as ConnectionRef;

  function initialize() {
  const conn = connection.value;
    if (!conn) {
      console.warn('No connection provided to characterStore');
      return;
    }

    // Setup event listeners
    conn.db.character.onInsert((_ctx: any, character: Character) => {
      const updated = new Map(characters.value);
      updated.set(character.characterId, character);
      characters.value = updated;
      console.debug('🧙‍♂️ New character inserted:', updated);

      if (character.userId.toHexString() === mainStore.currentUser?.userId.toHexString()) {
        currentCharacter.value = character;
      }
    });

    conn.db.character.onUpdate((_ctx: any, oldCharacter: Character, newCharacter: Character) => {
      const updated = new Map(characters.value);
      updated.delete(oldCharacter.characterId);
      updated.set(newCharacter.characterId, newCharacter);
      characters.value = updated;
      console.debug('🧙‍♂️ Updated character:', updated);
    });

    conn.db.character.onDelete((_ctx: any, character: Character) => {
      const updated = new Map(characters.value);
      updated.delete(character.characterId);
      characters.value = updated;
      console.debug('🧙‍♂️ Deleted character:', updated);

      if (character.userId.toHexString() === mainStore.currentUser?.userId.toHexString()) {
        currentCharacter.value = null;
      }
    });

    conn.reducers.onAddCharacter((e: any) => {
      if (e.event.status.tag === 'Failed') {
        console.error('AddCharacter failed:', e.event.status.value);
      } else {
        console.debug('AddCharacter succeeded');
      }
    });

    conn.reducers.onUpdateCharacter((e: any) => {
      if (e.event.status.tag === 'Failed') {
        console.error('UpdateCharacter failed:', e.event.status.value);
      } else {
        console.log('UpdateCharacter succeeded');
      }
    });
  }

  function addCharacter(character: AddCharacterInput) {
    if (!connection.value) {
      console.warn('No active SpaceTimeDB connection');
      return;
    }
    connection.value.reducers.addCharacter(character);
  }

  function updateCharacter(character: UpdateCharacterInput) {
    if (!connection.value) {
      console.warn('No active SpaceTimeDB connection');
      return;
    }

    const payload: UpdateCharacterInput = { ...character };

    if (payload.quests && currentCharacter.value?.quests) {
      const existingIds = new Set(
        currentCharacter.value.quests.map((q) => q.questId)
      );
      const filtered = payload.quests.filter((q) => !existingIds.has(q.questId));

      if (filtered.length > 0) {
        payload.quests = filtered;
      } else {
        // prevent sending empty quest array
        delete (payload as any).quests;
      }
    }

    connection.value.reducers.updateCharacter(payload);
  }

  function setCurrentCharacter(character: Character | null) 
  {
    currentCharacter.value = character;
  }

  function setCurrentCharacterLocation(region: Region) {
    if (currentCharacter.value) {
      const updatedCharacter = { characterId: currentCharacter.value.characterId, currentLocation: region.regionId };
      updateCharacter(updatedCharacter as UpdateCharacterInput);

      //update current region
      regionStore.setCurrentRegion(region);
      const connectedRegions = regionStore.findConnectedRegions(region.regionId);         
      regionStore.setLinkedRegion(connectedRegions);
  emitPhase('SPAWN_REGION', mainStore.currentUserId || null, { regionId: region.regionId });
  // Placeholder zone emission until zones implemented
  emitPhase('SPAWN_ZONE', mainStore.currentUserId || null, { regionId: region.regionId, zoneId: 'entry' });
    }
    else {
      console.error("No current character!");
    }
  }

  // Stub quest logging helper used by interaction engine
  function logQuest(data: { characterId?: string; quests: { questId: string; step: number; status: string }[] }) {
    if (!data.characterId) return;
    updateCharacter({ characterId: data.characterId, quests: data.quests } as UpdateCharacterInput);
  }

  return {
    characters,
    initialize,
    addCharacter,
    updateCharacter,
    setCurrentCharacter,
    currentCharacter,
    setCurrentCharacterLocation,
    logQuest,
  };
});
