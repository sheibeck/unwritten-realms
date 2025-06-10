import { defineStore } from 'pinia';
import { ref, computed, shallowRef} from 'vue';
import type {
  Character,
  AddCharacterInput,
  UpdateCharacterInput,
  Region
} from '../module_bindings/client';
import { useMainStore } from './mainStore';
import { useRegionStore } from './regionStore';

export const useCharacterStore = defineStore('characterStore', () => {
  const characters = ref<Map<string, Character>>(new Map());
  const currentCharacter = shallowRef<Character | null>();
  const mainStore = useMainStore();
  const regionStore = useRegionStore();
  const connection = computed(() => mainStore.connection);

  function initialize() {
    if (!connection.value) {
      console.warn('No connection provided to charcterStore');
      return;
    }

    // Setup event listeners
    connection.value.db.character.onInsert((_ctx, character) => {
      const updated = new Map(characters.value);
      updated.set(character.characterId, character);
      characters.value = updated;
      console.debug('🧙‍♂️ New character inserted:', updated);

      if (character.userId.toHexString() === mainStore.currentUser?.userId.toHexString()) {
        currentCharacter.value = character;
      }
    });

    connection.value.db.character.onUpdate((_ctx, oldCharacter, newCharacter) => {
      const updated = new Map(characters.value);
      updated.delete(oldCharacter.characterId);
      updated.set(newCharacter.characterId, newCharacter);
      characters.value = updated;
      console.debug('🧙‍♂️ Updated character:', updated);
    });

    connection.value.db.character.onDelete((_ctx, character) => {
      const updated = new Map(characters.value);
      updated.delete(character.characterId);
      characters.value = updated;
      console.debug('🧙‍♂️ Deleted character:', updated);

      if (character.userId.toHexString() === mainStore.currentUser?.userId.toHexString()) {
        currentCharacter.value = null;
      }
    });

    connection.value.reducers.onAddCharacter((e) => {
      if (e.event.status.tag === 'Failed') {
        console.error('AddCharacter failed:', e.event.status.value);
      } else {
        console.debug('AddCharacter succeeded');
      }
    });

    connection.value.reducers.onUpdateCharacter((e) => {
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
    
    connection.value.reducers.updateCharacter(character);
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
    }
    else {
      console.error("No current character!");
    }
  }

  return {
    characters,
    initialize,
    addCharacter,
    updateCharacter,
    setCurrentCharacter,
    currentCharacter,
    setCurrentCharacterLocation,
  };
});
