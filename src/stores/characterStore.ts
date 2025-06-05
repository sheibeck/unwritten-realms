import { defineStore } from 'pinia';
import { ref, computed, shallowRef} from 'vue';
import type {
  Character,
  AddCharacterInput,
  UpdateCharacterInput
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
      console.log('🧙‍♂️ New character inserted:', updated);

      if (character.userId.toHexString() === mainStore.currentUser?.userId.toHexString()) {
        currentCharacter.value = character;
      }
    });

    connection.value.db.character.onUpdate((_ctx, oldCharacter, newCharacter) => {
      const updated = new Map(characters.value);
      updated.delete(oldCharacter.characterId);
      updated.set(newCharacter.characterId, newCharacter);
      characters.value = updated;
      console.log('🧙‍♂️ Updated character:', updated);

      if (newCharacter.userId.toHexString() === mainStore.currentUser?.userId.toHexString()) {
        currentCharacter.value = newCharacter;

        if (oldCharacter.currentLocation !== newCharacter.currentLocation) {
          
          const newRegion = regionStore.findRegionById(newCharacter.currentLocation);
          if (newRegion) {
            regionStore.setCurrentRegion(newRegion);
            const connectedRegions = regionStore.findConnectedRegions(newRegion.regionId);         
            regionStore.setLinkedRegion(connectedRegions);
          }
        }
      }
    });

    connection.value.db.character.onDelete((_ctx, character) => {
      const updated = new Map(characters.value);
      updated.delete(character.characterId);
      characters.value = updated;
      console.log('🧙‍♂️ Deleted character:', updated);

      if (character.userId.toHexString() === mainStore.currentUser?.userId.toHexString()) {
        currentCharacter.value = null;
      }
    });

    connection.value.reducers.onAddCharacter((e) => {
      if (e.event.status.tag === 'Failed') {
        console.error('AddCharacter failed:', e.event.status.value);
      } else {
        console.log('AddCharacter succeeded');
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

  function setCurrentCharacterLocation(regionId: string) {
    if (currentCharacter.value) {
      const updatedCharacter = { "characterId": currentCharacter.value.characterId, "currentLocation": regionId };
      updateCharacter(updatedCharacter as UpdateCharacterInput);
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
